import { useEffect, useRef, useState, useCallback } from 'react';
import { HybridDrumEngine } from './HybridDrumEngine';
import { GuitarEngine } from './GuitarEngine';
import { NativeGuitarEngine } from './NativeGuitarEngine';
import { Recorder } from './Recorder';
import { mergeRecordings } from './mergeRecording';
import { computeLoopTrimSeconds, trimAudioBuffer } from './loopTrim';
import { audioBufferToMp3Blob } from './mp3Encode';
import { Scheduler, SCHEDULER_START_PREROLL_SECONDS } from './Scheduler';
import { DEFAULT_KIT_ID, getKit } from '../data/kits';
import { isTauriRuntime } from '../utils/platform';

function formatTimestamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(
    date.getHours()
  )}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}

// Persisted across restarts (not just session state) — this is a
// hardware-latency calibration value for one specific machine/interface,
// not a per-take setting, so it should stay put once dialed in.
const SYNC_OFFSET_STORAGE_KEY = 'pocket-studio:guitar-sync-offset-ms';

// Measured default for this rig (Focusrite Scarlett via ASIO, WebView2):
// audioCtx.outputLatency alone leaves the native drum engine's automatic
// compensation (see useAudioEngine's toggleRecording) about 22ms short of
// the real browser-monitoring latency, found by ear via the Guitar/Mic Sync
// slider. Used only the first time the app runs (or after localStorage is
// cleared) — the slider immediately overwrites this with whatever the user
// dials in, and that value then takes over from here on.
const DEFAULT_SYNC_OFFSET_MS = -22;

function readStoredSyncOffset() {
  try {
    const raw = localStorage.getItem(SYNC_OFFSET_STORAGE_KEY);
    const parsed = raw === null ? DEFAULT_SYNC_OFFSET_MS : Number(raw);
    return Number.isFinite(parsed) ? parsed : DEFAULT_SYNC_OFFSET_MS;
  } catch {
    return DEFAULT_SYNC_OFFSET_MS;
  }
}

// ASIO driver/channel choice for the native (Tauri) path — same
// persisted-across-restarts reasoning as the sync offset above: a
// hardware-setup calibration, not a per-take setting. `null` driver name
// means "let the Rust side use its own Focusrite-first-else-first-driver
// fallback" (see asio_engine.rs's start()) — never persisted until the
// user actually picks something in the ASIO settings dialog, so the
// developer's own existing Scarlett Solo setup keeps working with zero
// configuration after this feature ships.
const ASIO_DRIVER_STORAGE_KEY = 'pocket-studio:asio-driver-name';
const ASIO_GUITAR_CHANNEL_STORAGE_KEY = 'pocket-studio:asio-guitar-channel';
const ASIO_MIC_CHANNEL_STORAGE_KEY = 'pocket-studio:asio-mic-channel';
const DEFAULT_ASIO_GUITAR_CHANNEL = 1;
const DEFAULT_ASIO_MIC_CHANNEL = 0;

function readStoredAsioDriverName() {
  try {
    return localStorage.getItem(ASIO_DRIVER_STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

function readStoredAsioChannel(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw === null ? fallback : Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

// Drum-bus volume (0..1), independent of the guitar/mic output_gain — see
// the dedicated `drumGain` node inserted between HybridDrumEngine and
// masterOut in ensureEngine() below. Persisted like the other hardware/mix
// calibration values above, since it's a "how loud should the drums sit in
// the mix" preference the player dials in once, not a per-take setting.
const DRUM_VOLUME_STORAGE_KEY = 'pocket-studio:drum-volume';
const DEFAULT_DRUM_VOLUME = 0.8;

function readStoredDrumVolume() {
  try {
    const raw = localStorage.getItem(DRUM_VOLUME_STORAGE_KEY);
    const parsed = raw === null ? DEFAULT_DRUM_VOLUME : Number(raw);
    return Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed)) : DEFAULT_DRUM_VOLUME;
  } catch {
    return DEFAULT_DRUM_VOLUME;
  }
}

// Which recordings are archived (hidden from RecordingPanel.jsx's main
// list, but never deleted) — keyed by filename, not by the `id` field on a
// recording entry, since `id` is regenerated every session, while filename
// is the one thing that survives a restart. A rename (see renameRecording
// below) moves an archived entry's key from its old filename to the new
// one so archiving doesn't silently reset.
const ARCHIVED_RECORDINGS_STORAGE_KEY = 'pocket-studio:archived-recordings';

function readArchivedRecordingFilenames() {
  try {
    const raw = localStorage.getItem(ARCHIVED_RECORDINGS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function writeArchivedRecordingFilenames(set) {
  try {
    localStorage.setItem(ARCHIVED_RECORDINGS_STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    // localStorage unavailable - archiving still works for this session
  }
}

// Erzeugt AudioContext/Engine/Scheduler lazy beim ersten Play- oder
// Kit-Klick, weil Browser AudioContext ohne vorherige User-Geste blockieren.
export function useAudioEngine(pattern) {
  const engineRef = useRef(null);
  const patternRef = useRef(pattern);
  const recordingsRef = useRef([]);
  const archivedFilenamesRef = useRef(readArchivedRecordingFilenames());
  // Read inside ensureEngine (a useCallback with an empty dep array, so it
  // can't close over the `drumVolume` state directly) to seed the drumGain
  // node's initial value — kept in sync by setDrumVolume further down.
  const drumVolumeRef = useRef(readStoredDrumVolume());
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [kitId, setKitId] = useState(DEFAULT_KIT_ID);
  const [isKitLoading, setIsKitLoading] = useState(false);
  const [guitarConnected, setGuitarConnected] = useState(false);
  const [guitarDevices, setGuitarDevices] = useState([]);
  const [selectedGuitarDeviceId, setSelectedGuitarDeviceId] = useState(null);
  const [guitarModelInfo, setGuitarModelInfo] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordings, setRecordings] = useState([]);
  const [loopRecording, setLoopRecording] = useState(false);
  const [drumVolume, setDrumVolumeState] = useState(readStoredDrumVolume);
  const [syncOffsetMs, setSyncOffsetMsState] = useState(readStoredSyncOffset);
  const [asioDriverName, setAsioDriverNameState] = useState(readStoredAsioDriverName);
  const [asioGuitarChannel, setAsioGuitarChannelState] = useState(() =>
    readStoredAsioChannel(ASIO_GUITAR_CHANNEL_STORAGE_KEY, DEFAULT_ASIO_GUITAR_CHANNEL)
  );
  const [asioMicChannel, setAsioMicChannelState] = useState(() =>
    readStoredAsioChannel(ASIO_MIC_CHANNEL_STORAGE_KEY, DEFAULT_ASIO_MIC_CHANNEL)
  );
  const recordingStartedAtRef = useRef(null);
  // Recording-tap-only native drum engine (see asio_engine.rs/
  // drum_engine.rs) — tracks whether the Rust side actually has a usable
  // kit+pattern loaded, so toggleRecording knows whether the native WAV
  // file already contains drums (skip the old browser+native JS merge) or
  // not (fall back to it exactly as before). Kept as refs, not state —
  // purely an internal bookkeeping detail, never rendered.
  const nativeKitLoadedRef = useRef(false);
  const nativePatternSetRef = useRef(false);
  const nativeDrumsForTakeRef = useRef(false);
  const [tunerEnabled, setTunerEnabledState] = useState(false);
  const [tunerReading, setTunerReading] = useState(null);

  patternRef.current = pattern;
  recordingsRef.current = recordings;

  const ensureEngine = useCallback(() => {
    if (engineRef.current) return engineRef.current;
    // Startet immer mit DEFAULT_KIT_ID; ein vorheriger selectKit()-Aufruf
    // (der ensureEngine() ebenfalls auslöst) korrigiert das Kit direkt danach.
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)({
      latencyHint: 'interactive', // wichtig für Gitarre: kurze Buffer statt Durchsatz-Optimierung
    });

    // Gemeinsamer Ausgang für Drums UND Gitarre (CLAUDE.md: "gemeinsamer
    // Ausgang mit Drum-Sequencer"), statt dass jede Quelle einzeln direkt
    // auf ctx.destination geht — macht z.B. eine spätere gemeinsame
    // Aufnahme (MediaStreamAudioDestinationNode) trivial.
    const masterOut = audioCtx.createGain();
    masterOut.connect(audioCtx.destination);

    // Zusätzlicher Abgriff für die Riff-Aufnahme (CLAUDE.md): derselbe
    // gemeinsame Mix aus Drums + Gitarre, parallel zur Hardware-Ausgabe.
    const recordingDestination = audioCtx.createMediaStreamDestination();
    masterOut.connect(recordingDestination);
    const recorder = new Recorder(recordingDestination.stream);

    // Dedicated gain stage for drums only, inserted before masterOut so the
    // drum-volume slider (see setDrumVolume below) can't touch the guitar/
    // mic signal that also shares masterOut. Initialized to the persisted
    // value right away, not left at the AudioParam default of 1, so a
    // previously dialed-in level actually takes effect on first playback.
    const drumGain = audioCtx.createGain();
    drumGain.gain.value = drumVolumeRef.current;
    drumGain.connect(masterOut);

    const engine = new HybridDrumEngine(audioCtx, getKit(DEFAULT_KIT_ID), drumGain);
    const scheduler = new Scheduler(audioCtx, engine);
    scheduler.onStep = (step) => setCurrentStep(step);
    // Inside the Tauri shell, drive the real native ASIO passthrough
    // instead of the browser Web Audio amp-sim — same method surface on
    // both, see NativeGuitarEngine.js. Its audio never touches audioCtx/
    // masterOut at all — it combines with the drums only at the hardware
    // output for monitoring, and is recorded completely separately (see
    // toggleRecording: a native WAV file written straight to disk by
    // Rust, not through this Recorder/masterOut at all).
    const guitar = isTauriRuntime()
      ? new NativeGuitarEngine()
      : new GuitarEngine(audioCtx, masterOut);
    engineRef.current = { audioCtx, masterOut, drumGain, engine, scheduler, guitar, recorder };
    engine.loadSamples(DEFAULT_KIT_ID); // no-op falls keine echten Samples vorliegen

    // Debug-Zugriff in der Browser-Konsole (nur Dev-Build), z.B. für
    // Latenz-Diagnose: window.__pocketStudio.audioCtx.baseLatency /
    // .outputLatency.
    if (import.meta.env.DEV) {
      window.__pocketStudio = engineRef.current;
    }

    return engineRef.current;
  }, []);

  useEffect(() => {
    engineRef.current?.scheduler.setPattern(patternRef.current);
    // Native-only — keeps the recording-tap drum engine's pattern current
    // (see toggleRecording/asio_engine.rs). Errors here just mean the next
    // take's native file won't include drums; the browser+merge fallback
    // still kicks in at record-stop time, nothing throws up to the caller.
    const guitar = engineRef.current?.guitar;
    if (guitar?.setDrumPattern) {
      guitar
        .setDrumPattern(pattern)
        .then(() => {
          nativePatternSetRef.current = true;
        })
        .catch((err) => {
          console.error('Native drum pattern update failed:', err);
          nativePatternSetRef.current = false;
        });
    }
  }, [pattern]);

  useEffect(() => {
    return () => {
      engineRef.current?.scheduler.stop();
      engineRef.current?.guitar.dispose();
      engineRef.current?.audioCtx.close();
      recordingsRef.current.forEach((r) => r.url && URL.revokeObjectURL(r.url));
    };
  }, []);

  const toggle = useCallback(async () => {
    const { audioCtx, scheduler } = ensureEngine();
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume();
    }
    if (scheduler.isRunning) {
      scheduler.stop();
      setIsPlaying(false);
      setCurrentStep(-1);
    } else {
      scheduler.setPattern(patternRef.current);
      scheduler.start();
      setIsPlaying(true);
    }
  }, [ensureEngine]);

  const stop = useCallback(() => {
    const engine = engineRef.current;
    if (engine?.scheduler.isRunning) {
      engine.scheduler.stop();
      setIsPlaying(false);
      setCurrentStep(-1);
    }
  }, []);

  const selectKit = useCallback(
    async (id) => {
      const { engine, guitar } = ensureEngine();
      const kitConfig = getKit(id);
      engine.setKit(kitConfig);
      setKitId(id);
      setIsKitLoading(true);
      await engine.loadSamples(id);
      setIsKitLoading(false);
      // Native-only, and only meaningful once a session exists (fails
      // harmlessly with "not connected" before connectGuitar() — see
      // connectGuitar below, which retries this once a session starts).
      if (guitar.loadDrumKit) {
        try {
          await guitar.loadDrumKit(id);
          nativeKitLoadedRef.current = true;
        } catch (err) {
          console.error('Native drum kit load failed (recording will fall back to the browser+merge path):', err);
          nativeKitLoadedRef.current = false;
        }
      }
    },
    [ensureEngine]
  );

  const connectGuitar = useCallback(
    async (deviceId) => {
      const { guitar } = ensureEngine();
      // NativeGuitarEngine (Tauri) ignores `deviceId` and instead reads the
      // ASIO driver/channel choice made via the settings dialog (see
      // AsioSettingsDialog.jsx) — GuitarEngine.js (plain browser fallback)
      // only ever sees the plain deviceId string it already expected.
      await guitar.connectInput(
        isTauriRuntime()
          ? { driverName: asioDriverName, guitarChannel: asioGuitarChannel, micChannel: asioMicChannel }
          : deviceId
      ); // wirft bei verweigerter/fehlender Berechtigung
      setGuitarConnected(true);
      setSelectedGuitarDeviceId(deviceId ?? null);
      const devices = await guitar.listInputDevices(); // Labels erst nach erteilter Berechtigung verfügbar
      setGuitarDevices(devices);

      // Native drums (recording-tap-only): the session only exists from
      // here on, so re-push whatever kit/pattern are currently selected —
      // selectKit()/the pattern effect may well have already tried and
      // failed with "not connected" before this ran.
      if (guitar.loadDrumKit) {
        try {
          await guitar.loadDrumKit(kitId);
          nativeKitLoadedRef.current = true;
        } catch (err) {
          console.error('Native drum kit load failed after connect:', err);
          nativeKitLoadedRef.current = false;
        }
      }
      if (guitar.setDrumPattern) {
        try {
          await guitar.setDrumPattern(patternRef.current);
          nativePatternSetRef.current = true;
        } catch (err) {
          console.error('Native drum pattern set failed after connect:', err);
          nativePatternSetRef.current = false;
        }
      }
    },
    [ensureEngine, kitId, asioDriverName, asioGuitarChannel, asioMicChannel]
  );

  // Awaits disconnectInput() before flipping `guitarConnected` — that keeps
  // GuitarPanel/MicPanel showing the "connected" UI (select + Trennen)
  // until the native ASIO session has actually torn down, so the user
  // can't click "Verbinden" again while the old session is still being
  // dismantled (see the comment on NativeGuitarEngine.disconnectInput for
  // why that race was corrupting the audio mix).
  const disconnectGuitar = useCallback(async () => {
    await engineRef.current?.guitar.disconnectInput();
    setGuitarConnected(false);
  }, []);

  const refreshGuitarDevices = useCallback(async () => {
    const guitar = engineRef.current?.guitar;
    if (!guitar) return;
    setGuitarDevices(await guitar.listInputDevices());
  }, []);

  const setGuitarInputGain = useCallback((value) => {
    engineRef.current?.guitar.setInputGain(value);
  }, []);

  const setGuitarOutputGain = useCallback((value) => {
    engineRef.current?.guitar.setOutputGain(value);
  }, []);

  const setGuitarBass = useCallback((db) => {
    engineRef.current?.guitar.setBass(db);
  }, []);

  const setGuitarMid = useCallback((db) => {
    engineRef.current?.guitar.setMid(db);
  }, []);

  const setGuitarTreble = useCallback((db) => {
    engineRef.current?.guitar.setTreble(db);
  }, []);

  const setGuitarReverb = useCallback((amount) => {
    engineRef.current?.guitar.setReverb(amount);
  }, []);

  // Native-only (NativeGuitarEngine) — the browser GuitarEngine has no
  // delay effect. Optional chaining keeps this a silent no-op there.
  const setGuitarDelayEnabled = useCallback((enabled) => {
    engineRef.current?.guitar.setDelayEnabled?.(enabled);
  }, []);

  const setGuitarDelay = useCallback((amount) => {
    engineRef.current?.guitar.setDelay?.(amount);
  }, []);

  // Native-only (NativeGuitarEngine) — the vocal mic is a second channel
  // on the same native audio interface, so it has no browser-GuitarEngine
  // equivalent at all. Optional chaining keeps this a silent no-op there.
  const setMicEnabled = useCallback((enabled) => {
    engineRef.current?.guitar.setMicEnabled?.(enabled);
  }, []);

  const setMicGain = useCallback((value) => {
    engineRef.current?.guitar.setMicGain?.(value);
  }, []);

  const setMicReverb = useCallback((amount) => {
    engineRef.current?.guitar.setMicReverb?.(amount);
  }, []);

  // Drum-bus volume — independent of the guitar/mic setGuitarOutputGain
  // above, see the dedicated drumGain node in ensureEngine(). Also pushed
  // to the native recording tap (guitar.setDrumGain, a no-op via optional
  // chaining on the plain browser GuitarEngine) so a native-drums take
  // matches what was actually heard live, not a fixed default level.
  const setDrumVolume = useCallback((value) => {
    const clamped = Math.min(1, Math.max(0, value));
    drumVolumeRef.current = clamped;
    setDrumVolumeState(clamped);
    try {
      localStorage.setItem(DRUM_VOLUME_STORAGE_KEY, String(clamped));
    } catch {
      // localStorage unavailable - the value still works for this session
    }
    const { drumGain, guitar } = ensureEngine();
    drumGain.gain.value = clamped;
    guitar.setDrumGain?.(clamped);
  }, [ensureEngine]);

  // Native-only (NativeGuitarEngine) — the browser GuitarEngine has no
  // pitch detection. Optional chaining keeps this a silent no-op there.
  const setGuitarTunerEnabled = useCallback((enabled) => {
    engineRef.current?.guitar.setTunerEnabled?.(enabled);
    setTunerEnabledState(enabled);
    if (!enabled) setTunerReading(null);
  }, []);

  // Polls the latest pitch reading while the tuner is switched on. Polling
  // (not a push event) keeps this symmetric with how every other guitar
  // control already works here — plain invoke() calls, no Tauri event
  // plumbing needed for a ~100ms-latency display value.
  useEffect(() => {
    if (!tunerEnabled) return undefined;
    const guitar = engineRef.current?.guitar;
    if (!guitar?.getTunerReading) return undefined;
    const id = setInterval(async () => {
      const reading = await guitar.getTunerReading();
      setTunerReading(reading);
    }, 100);
    return () => clearInterval(id);
  }, [tunerEnabled]);

  const getLatencyInfo = useCallback(() => {
    return engineRef.current?.guitar.getLatencyInfo() ?? null;
  }, []);

  const setSyncOffsetMs = useCallback((ms) => {
    setSyncOffsetMsState(ms);
    try {
      localStorage.setItem(SYNC_OFFSET_STORAGE_KEY, String(ms));
    } catch {
      // localStorage unavailable - the value still works for this session
    }
  }, []);

  // Single setter for all three ASIO settings — AsioSettingsDialog.jsx
  // saves driver + both channels together in one go. Doesn't reconnect an
  // already-open session; the dialog tells the user to disconnect/
  // reconnect via the normal Guitar panel button to apply a change.
  const setAsioSettings = useCallback(({ driverName, guitarChannel, micChannel }) => {
    setAsioDriverNameState(driverName ?? null);
    setAsioGuitarChannelState(guitarChannel);
    setAsioMicChannelState(micChannel);
    try {
      if (driverName) {
        localStorage.setItem(ASIO_DRIVER_STORAGE_KEY, driverName);
      } else {
        localStorage.removeItem(ASIO_DRIVER_STORAGE_KEY);
      }
      localStorage.setItem(ASIO_GUITAR_CHANNEL_STORAGE_KEY, String(guitarChannel));
      localStorage.setItem(ASIO_MIC_CHANNEL_STORAGE_KEY, String(micChannel));
    } catch {
      // localStorage unavailable - the values still work for this session
    }
  }, []);

  // Wraps NativeGuitarEngine.probeChannels — lets the ASIO settings dialog
  // show how many input channels a driver has before the user commits to
  // connecting. Only meaningful in Tauri; callers gate on isTauriRuntime().
  const probeAsioChannels = useCallback((driverName) => {
    const { guitar } = ensureEngine();
    return guitar.probeChannels(driverName);
  }, [ensureEngine]);

  // Native-only (NativeGuitarEngine) — the browser GuitarEngine has no
  // model concept, it's a fixed classic amp-sim. No-op there.
  const loadGuitarModel = useCallback(async () => {
    const guitar = engineRef.current?.guitar;
    if (!guitar?.pickAndLoadModel) return null;
    const info = await guitar.pickAndLoadModel();
    if (info) setGuitarModelInfo(info);
    return info;
  }, []);

  const toggleRecording = useCallback(async () => {
    const { audioCtx, scheduler, recorder, guitar } = ensureEngine();
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume();
    }
    if (recorder.isRecording) {
      // Native-only — stop capture on the Rust side first; the WAV file
      // finalizes asynchronously on a background thread there (see
      // NativeGuitarEngine.getLastRecordingPath), so kick that off before
      // waiting on the (independent) browser drum recording below.
      // Awaited (not fire-and-forget) so the Rust-side flag flip — and the
      // audio-callback edge it triggers — is confirmed before the browser
      // recorder stops too. Without this, an IPC round-trip's worth of
      // guitar/mic audio could go missing or linger past where the drums
      // recording ends.
      await guitar.setRecordingActive?.(false);
      const nativePathPromise = guitar.getLastRecordingPath?.() ?? Promise.resolve(null);
      const blob = await recorder.stop();

      const elapsedSeconds = recordingStartedAtRef.current
        ? (Date.now() - recordingStartedAtRef.current) / 1000
        : null;
      const trimSeconds =
        loopRecording && elapsedSeconds
          ? computeLoopTrimSeconds(elapsedSeconds, patternRef.current.bpm)
          : null;
      recordingStartedAtRef.current = null;

      // Always decode -> (optionally trim to the last full bar) -> encode
      // as MP3, instead of handing back the raw compressed webm/opus blob
      // MediaRecorder produced. A compressed blob can't be truncated by
      // cutting bytes anyway, so loop mode already needed this decode step
      // — it now just always runs, so every take (pure-browser mode) ends
      // up MP3 too, not just loop-trimmed ones.
      let finalBlob = blob;
      let extension = blob.type.includes('ogg') ? 'ogg' : 'webm';
      try {
        const decoded = await audioCtx.decodeAudioData(await blob.arrayBuffer());
        const bufferToEncode =
          trimSeconds !== null ? trimAudioBuffer(audioCtx, decoded, trimSeconds) : decoded;
        finalBlob = audioBufferToMp3Blob(bufferToEncode);
        extension = 'mp3';
      } catch (err) {
        console.error('Converting the recording to MP3 failed, keeping the original take:', err);
      }

      const loopSuffix = trimSeconds !== null ? '-loop' : '';
      const nativePath = await nativePathPromise;
      // Whether the native WAV already has drums mixed in (see
      // asio_engine.rs's recording-tap change) — decided per-take at
      // record-start, not re-checked here, since that's the state that
      // actually applied while this take was being captured.
      const nativeIncludesDrums = nativeDrumsForTakeRef.current;

      setIsRecording(false);
      // Undoes the setRecording(true) above — otherwise a later Play (no
      // recording involved) would silently keep timing humanize suppressed.
      scheduler.setRecording(false);
      // Mirrors the auto-start on record: drums stop together with the
      // recording instead of continuing to play afterward.
      if (scheduler.isRunning) {
        scheduler.stop();
        setIsPlaying(false);
        setCurrentStep(-1);
      }

      // Exactly one list entry per take — the finished drums+guitar/mic
      // (+vocal) mix, never the separate raw tracks that went into it.
      // Every branch below ends up with both a real on-disk `path` (so the
      // trash button in RecordingPanel.jsx can actually delete the file,
      // not just the list entry) and a blob `url` (so it plays right in
      // the app instead of only offering a download).
      if (nativePath && nativeIncludesDrums) {
        // The native MP3 already IS the complete, guaranteed-in-sync mix
        // (drums summed into the same buffer as guitar/mic/vocal, encoded
        // straight to MP3 — see asio_engine.rs) — just read it back for
        // in-app playback.
        try {
          const bytes = await window.__TAURI__.core.invoke('read_native_recording', { path: nativePath });
          let mp3Bytes = new Uint8Array(bytes);
          let finalPath = nativePath;
          let filename = nativePath.split(/[\\/]/).pop();

          // The native writer (asio_engine.rs) has no concept of "loop
          // mode" — it just captures the whole take — so loop-trimming has
          // to happen here in JS, same as the browser-only paths below,
          // before this ever reaches RecordingPanel.jsx. Without this, the
          // "Loop recording" checkbox silently did nothing whenever native
          // drums were active (the default/only visible kit), which is
          // most of the time — a real bug, not just a missing UI touch.
          if (trimSeconds !== null) {
            try {
              const decoded = await audioCtx.decodeAudioData(mp3Bytes.buffer);
              const trimmed = trimAudioBuffer(audioCtx, decoded, trimSeconds);
              const trimmedBlob = audioBufferToMp3Blob(trimmed);
              const trimmedBytes = new Uint8Array(await trimmedBlob.arrayBuffer());
              const dot = filename.lastIndexOf('.');
              const trimmedFilename = `${filename.slice(0, dot)}-loop${filename.slice(dot)}`;
              const savedPath = await window.__TAURI__.core.invoke('save_recording_bytes', trimmedBytes, {
                headers: { 'x-filename': trimmedFilename },
              });
              // The untrimmed original is now redundant (superseded by the
              // trimmed file above) — trashed, not hard-deleted, same
              // safety net as the manual delete button.
              try {
                await window.__TAURI__.core.invoke('delete_recording_file', { path: nativePath });
              } catch (err) {
                console.error('Removing the untrimmed native take failed (harmless, just leaves an extra file):', err);
              }
              mp3Bytes = trimmedBytes;
              finalPath = savedPath;
              filename = trimmedFilename;
            } catch (err) {
              console.error('Loop-trimming the native recording failed, keeping the untrimmed take:', err);
            }
          }

          const mixBlob = new Blob([mp3Bytes], { type: 'audio/mpeg' });
          const url = URL.createObjectURL(mixBlob);
          setRecordings((prev) => [
            { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, path: finalPath, url, filename, createdAt: Date.now(), archived: false },
            ...prev,
          ]);
        } catch (err) {
          console.error('Reading the native recording back for playback failed:', err);
        }
      } else if (nativePath && !nativeIncludesDrums) {
        // Fallback: native drums weren't available for this take (e.g. a
        // kit without full native sample coverage) — merge the browser
        // drums recording with the native guitar/mic MP3 in JS, same as
        // before this change, then save the result to disk too so it's
        // just as deletable/playable as the native-drums case above.
        // Can take a moment on a longer take — don't block the UI on it.
        mergeRecordings(blob, nativePath, trimSeconds, syncOffsetMs, elapsedSeconds)
          .then(async (mergedBlob) => {
            const mergedFilename = `pocket-studio-riff-${formatTimestamp()}${loopSuffix}-mix.mp3`;
            const url = URL.createObjectURL(mergedBlob);
            let savedPath = null;
            try {
              const mergedBytes = Array.from(new Uint8Array(await mergedBlob.arrayBuffer()));
              savedPath = await window.__TAURI__.core.invoke('save_recording_bytes', {
                bytes: mergedBytes,
                filename: mergedFilename,
              });
            } catch (err) {
              console.error('Saving the merged recording to disk failed:', err);
            }
            setRecordings((prev) => [
              { id: `${Date.now()}-${Math.random().toString(36).slice(2)}-mix`, path: savedPath, url, filename: mergedFilename, createdAt: Date.now(), archived: false },
              ...prev,
            ]);
          })
          .catch((err) => {
            console.error('mergeRecordings failed:', err);
          });
      } else {
        // Pure browser mode (no Tauri/native chain at all) — the
        // recorder's own blob already IS the complete drums+guitar mix
        // (ensureEngine routes both through the same shared masterOut ->
        // recordingDestination). No filesystem path to save to here;
        // the trash button falls back to "remove from the list only".
        const url = URL.createObjectURL(finalBlob);
        const filename = `pocket-studio-riff-${formatTimestamp()}${loopSuffix}.${extension}`;
        setRecordings((prev) => [
          { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, url, filename, createdAt: Date.now(), archived: false },
          ...prev,
        ]);
      }
    } else {
      // Awaited so the native chain has actually confirmed it started
      // capturing before the browser drum recorder does — previously this
      // was fire-and-forget, so recorder.start() could (and, per user
      // reports, reliably did) win the race and start a measurable amount
      // of time before the native WAV writer's first sample, making
      // guitar/vocals land early relative to the drums in every merged
      // take.
      // Snapshot now (not re-read at stop time) — whatever kit/pattern
      // state is current right as this take starts is what the native
      // recording tap will actually mix in.
      nativeDrumsForTakeRef.current = nativeKitLoadedRef.current && nativePatternSetRef.current;
      // Tells the Rust side whether to actually mix native drums into this
      // take's recording tap (see NativeGuitarEngine.setDrumRecordingEnabled's
      // doc) — without this, a take that just decided to skip native drums
      // (nativeDrumsForTakeRef.current === false, about to fall back to the
      // browser-drums merge below) would still get native drums doubled in
      // by the Rust side, which has no per-take memory of this decision and
      // just keeps rendering from whatever kit/pattern it last loaded
      // successfully. Must land before setRecordingActive(true) below,
      // same ordering requirement as setMonitoringLatencyMs.
      await guitar.setDrumRecordingEnabled?.(nativeDrumsForTakeRef.current);
      // Only the native recording tap needs this: it deliberately doesn't
      // reimplement Scheduler.js's ±12ms timing humanize (see drum_engine.rs's
      // module doc), so leaving it on here would make the live monitoring
      // the guitarist actually plays along to drift up to ~12ms per hit away
      // from the perfectly-quantized grid that gets recorded. The JS-merge
      // fallback and pure-browser paths capture the same Scheduler.js output
      // the player hears, so humanize there is already sample-for-sample
      // consistent and must stay on.
      scheduler.setRecording(nativeDrumsForTakeRef.current);
      // Tell the native drum engine how much browser-monitoring latency to
      // hold its step 0 back by, so the recorded grid lines up with what
      // the player actually heard (see NativeGuitarEngine.setMonitoringLatencyMs's
      // doc) — must land before setRecordingActive(true) flips the flag the
      // Rust side reads it on, hence awaited first and in this order.
      //
      // audioCtx.outputLatency is only an estimate — Chromium/WebView2 don't
      // guarantee it reflects the full OS mixer + driver chain down to the
      // speakers, so a few ms of residual offset can remain even once this
      // is applied. Rather than guess a hardware-specific fudge factor, reuse
      // the existing Guitar/Mic Sync slider (RecordingPanel) as a manual
      // trim on top of the measured value — same sign convention as its
      // merge-path use (see mergeRecording.js): negative delays the drums
      // (use if guitar/mic still comes in too late after the automatic
      // compensation), positive pulls drums earlier (guitar/mic too early).
      const monitoringLatencyMs = Math.max(
        0,
        (SCHEDULER_START_PREROLL_SECONDS + (audioCtx.outputLatency || audioCtx.baseLatency || 0)) * 1000 -
          syncOffsetMs
      );
      await guitar.setMonitoringLatencyMs?.(monitoringLatencyMs);
      await guitar.setRecordingActive?.(true);
      recordingStartedAtRef.current = Date.now();
      recorder.start();
      setIsRecording(true);
      // Drums start together with the recording (right after the
      // RecordingPanel count-in finishes) instead of requiring a separate
      // Play click — if the pattern's already running, leave it alone.
      if (!scheduler.isRunning) {
        scheduler.setPattern(patternRef.current);
        scheduler.start();
        setIsPlaying(true);
      }
    }
  }, [ensureEngine, loopRecording, syncOffsetMs]);

  // Metronome click for RecordingPanel's count-in (see there for timing —
  // one call per counted beat). Goes straight to audioCtx.destination,
  // not through masterOut, so it's never picked up by a recording even if
  // one happened to be starting right at that instant: the click is a
  // cue for the player, not part of the take.
  const playCountInClick = useCallback(
    (accent) => {
      const { audioCtx } = ensureEngine();
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'square';
      osc.frequency.value = accent ? 1800 : 1200;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.4, now + 0.002);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.06);
    },
    [ensureEngine]
  );

  // Deletes the underlying file from disk (Downloads) when the entry has
  // one — every take does now except the pure-browser-mode case, which
  // never gets a filesystem path in the first place (see toggleRecording)
  // and so just falls back to removing the list entry, same as before.
  const deleteRecording = useCallback((id) => {
    setRecordings((prev) => {
      const target = prev.find((r) => r.id === id);
      if (target?.url) URL.revokeObjectURL(target.url);
      if (target?.path && isTauriRuntime()) {
        window.__TAURI__.core.invoke('delete_recording_file', { path: target.path }).catch((err) => {
          console.error('Deleting the recording file failed:', err);
        });
      }
      if (target?.filename && archivedFilenamesRef.current.has(target.filename)) {
        archivedFilenamesRef.current.delete(target.filename);
        writeArchivedRecordingFilenames(archivedFilenamesRef.current);
      }
      return prev.filter((r) => r.id !== id);
    });
  }, []);

  // Renames a recording — the underlying file on disk when the entry has
  // one (native/merge-fallback takes), or just the in-memory label for a
  // pure-browser-mode take with no filesystem path (also updates its
  // <a download> filename, see RecordingPanel.jsx). `newBaseName` is the
  // name WITHOUT extension — the original extension is always kept, both
  // so a renamed take stays picked up by list_recordings' `.mp3`/`.wav`
  // filter after a restart, and so a stray typo can't turn a take into a
  // file nothing recognizes as audio anymore.
  const renameRecording = useCallback(async (id, newBaseName) => {
    const target = recordingsRef.current.find((r) => r.id === id);
    if (!target) return { ok: false, error: 'Recording not found.' };
    const trimmedBase = newBaseName.trim();
    if (!trimmedBase) return { ok: false, error: 'Name cannot be empty.' };
    const dotIndex = target.filename.lastIndexOf('.');
    const extension = dotIndex >= 0 ? target.filename.slice(dotIndex) : '';
    const currentBase = dotIndex >= 0 ? target.filename.slice(0, dotIndex) : target.filename;
    if (trimmedBase === currentBase) return { ok: true };
    const newFilename = `${trimmedBase}${extension}`;

    function applyRenameLocally(newPath) {
      if (archivedFilenamesRef.current.has(target.filename)) {
        archivedFilenamesRef.current.delete(target.filename);
        archivedFilenamesRef.current.add(newFilename);
        writeArchivedRecordingFilenames(archivedFilenamesRef.current);
      }
      setRecordings((prev) =>
        prev.map((r) => (r.id === id ? { ...r, path: newPath ?? r.path, filename: newFilename } : r))
      );
    }

    if (target.path && isTauriRuntime()) {
      try {
        const newPath = await window.__TAURI__.core.invoke('rename_recording_file', {
          path: target.path,
          newFilename,
        });
        applyRenameLocally(newPath);
        return { ok: true };
      } catch (err) {
        return { ok: false, error: String(err) };
      }
    }

    applyRenameLocally(null);
    return { ok: true };
  }, []);

  // Archives/unarchives a recording — hides it from RecordingPanel.jsx's
  // main list without touching the file (see the ARCHIVED_RECORDINGS_
  // STORAGE_KEY doc above for why this is keyed by filename, not id).
  const setRecordingArchived = useCallback((id, archived) => {
    setRecordings((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        if (archived) archivedFilenamesRef.current.add(r.filename);
        else archivedFilenamesRef.current.delete(r.filename);
        return { ...r, archived };
      })
    );
    writeArchivedRecordingFilenames(archivedFilenamesRef.current);
  }, []);

  return {
    isPlaying,
    currentStep,
    toggle,
    stop,
    kitId,
    isKitLoading,
    selectKit,
    guitarSupported: isTauriRuntime() ? NativeGuitarEngine.isSupported() : GuitarEngine.isSupported(),
    guitarConnected,
    guitarDevices,
    selectedGuitarDeviceId,
    connectGuitar,
    disconnectGuitar,
    refreshGuitarDevices,
    setGuitarInputGain,
    setGuitarOutputGain,
    setGuitarBass,
    setGuitarMid,
    setGuitarTreble,
    setGuitarReverb,
    setGuitarDelayEnabled,
    setGuitarDelay,
    setMicEnabled,
    setMicGain,
    setMicReverb,
    setGuitarTunerEnabled,
    tunerReading,
    getLatencyInfo,
    guitarModelInfo,
    loadGuitarModel,
    recordingSupported: Recorder.isSupported(),
    isRecording,
    recordings,
    toggleRecording,
    playCountInClick,
    deleteRecording,
    renameRecording,
    setRecordingArchived,
    loopRecording,
    setLoopRecording,
    drumVolume,
    setDrumVolume,
    syncOffsetMs,
    setSyncOffsetMs,
    asioDriverName,
    asioGuitarChannel,
    asioMicChannel,
    setAsioSettings,
    probeAsioChannels,
  };
}
