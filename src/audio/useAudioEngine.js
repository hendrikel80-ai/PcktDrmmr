import { useEffect, useRef, useState, useCallback } from 'react';
import { HybridDrumEngine } from './HybridDrumEngine';
import { GuitarEngine } from './GuitarEngine';
import { NativeGuitarEngine } from './NativeGuitarEngine';
import { Recorder } from './Recorder';
import { mergeRecordings } from './mergeRecording';
import { computeLoopTrimSeconds, trimAudioBuffer } from './loopTrim';
import { audioBufferToWavBlob } from './wavEncode';
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

function readStoredSyncOffset() {
  try {
    const raw = localStorage.getItem(SYNC_OFFSET_STORAGE_KEY);
    const parsed = raw === null ? 0 : Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
}

// Erzeugt AudioContext/Engine/Scheduler lazy beim ersten Play- oder
// Kit-Klick, weil Browser AudioContext ohne vorherige User-Geste blockieren.
export function useAudioEngine(pattern) {
  const engineRef = useRef(null);
  const patternRef = useRef(pattern);
  const recordingsRef = useRef([]);
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
  const [syncOffsetMs, setSyncOffsetMsState] = useState(readStoredSyncOffset);
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

    const engine = new HybridDrumEngine(audioCtx, getKit(DEFAULT_KIT_ID), masterOut);
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
    engineRef.current = { audioCtx, masterOut, engine, scheduler, guitar, recorder };
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
      await guitar.connectInput(deviceId); // wirft bei verweigerter/fehlender Berechtigung
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
    [ensureEngine, kitId]
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

      // Loop mode: a compressed webm/opus blob can't be truncated by
      // cutting bytes, so decode -> trim to the last full bar -> re-encode
      // as WAV. Skipped entirely when loop mode is off — the raw take
      // stays exactly as it always has.
      let finalBlob = blob;
      let extension = blob.type.includes('ogg') ? 'ogg' : 'webm';
      if (trimSeconds !== null) {
        try {
          const decoded = await audioCtx.decodeAudioData(await blob.arrayBuffer());
          const trimmed = trimAudioBuffer(audioCtx, decoded, trimSeconds);
          finalBlob = audioBufferToWavBlob(trimmed);
          extension = 'wav';
        } catch (err) {
          console.error('Loop trim failed, keeping the untrimmed take:', err);
        }
      }

      const loopSuffix = trimSeconds !== null ? '-loop' : '';
      const nativePath = await nativePathPromise;
      // Whether the native WAV already has drums mixed in (see
      // asio_engine.rs's recording-tap change) — decided per-take at
      // record-start, not re-checked here, since that's the state that
      // actually applied while this take was being captured.
      const nativeIncludesDrums = nativeDrumsForTakeRef.current;

      setIsRecording(false);
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
        // The native WAV already IS the complete, guaranteed-in-sync mix
        // (drums summed into the same buffer as guitar/mic/vocal — see
        // asio_engine.rs) — just read it back for in-app playback.
        try {
          const bytes = await window.__TAURI__.core.invoke('read_native_recording', { path: nativePath });
          const mixBlob = new Blob([new Uint8Array(bytes)], { type: 'audio/wav' });
          const url = URL.createObjectURL(mixBlob);
          const filename = nativePath.split(/[\\/]/).pop();
          setRecordings((prev) => [
            { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, path: nativePath, url, filename, createdAt: Date.now() },
            ...prev,
          ]);
        } catch (err) {
          console.error('Reading the native recording back for playback failed:', err);
        }
      } else if (nativePath && !nativeIncludesDrums) {
        // Fallback: native drums weren't available for this take (e.g. a
        // kit without full native sample coverage) — merge the browser
        // drums recording with the native guitar/mic WAV in JS, same as
        // before this change, then save the result to disk too so it's
        // just as deletable/playable as the native-drums case above.
        // Can take a moment on a longer take — don't block the UI on it.
        mergeRecordings(blob, nativePath, trimSeconds, syncOffsetMs, elapsedSeconds)
          .then(async (mergedBlob) => {
            const mergedFilename = `pocket-studio-riff-${formatTimestamp()}${loopSuffix}-mix.wav`;
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
              { id: `${Date.now()}-${Math.random().toString(36).slice(2)}-mix`, path: savedPath, url, filename: mergedFilename, createdAt: Date.now() },
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
          { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, url, filename, createdAt: Date.now() },
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
      // Tell the native drum engine how much browser-monitoring latency to
      // hold its step 0 back by, so the recorded grid lines up with what
      // the player actually heard (see NativeGuitarEngine.setMonitoringLatencyMs's
      // doc) — must land before setRecordingActive(true) flips the flag the
      // Rust side reads it on, hence awaited first and in this order.
      const monitoringLatencyMs =
        (SCHEDULER_START_PREROLL_SECONDS + (audioCtx.outputLatency || audioCtx.baseLatency || 0)) * 1000;
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
      return prev.filter((r) => r.id !== id);
    });
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
    loopRecording,
    setLoopRecording,
    syncOffsetMs,
    setSyncOffsetMs,
  };
}
