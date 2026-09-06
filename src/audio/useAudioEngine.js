import { useEffect, useRef, useState, useCallback } from 'react';
import { HybridDrumEngine } from './HybridDrumEngine';
import { GuitarEngine } from './GuitarEngine';
import { NativeGuitarEngine } from './NativeGuitarEngine';
import { GuitarRecordingTap } from './GuitarRecordingTap';
import { Recorder } from './Recorder';
import { Scheduler } from './Scheduler';
import { DEFAULT_KIT_ID, getKit } from '../data/kits';
import { isTauriRuntime } from '../utils/platform';

function formatTimestamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(
    date.getHours()
  )}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
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

    // Recording-only side channel for natively-rendered guitar audio (see
    // GuitarRecordingTap.js) — connects ONLY to recordingDestination, not
    // to masterOut/audioCtx.destination, so the guitar (already monitored
    // directly through ASIO) isn't also heard a second time through the
    // browser. No-op in practice unless the native engine actually pushes
    // samples into it (browser GuitarEngine's audio already reaches
    // recordingDestination via masterOut, untouched).
    const guitarRecordingTap = new GuitarRecordingTap(audioCtx, recordingDestination);

    const engine = new HybridDrumEngine(audioCtx, getKit(DEFAULT_KIT_ID), masterOut);
    const scheduler = new Scheduler(audioCtx, engine);
    scheduler.onStep = (step) => setCurrentStep(step);
    // Inside the Tauri shell, drive the real native ASIO passthrough
    // instead of the browser Web Audio amp-sim — same method surface on
    // both, see NativeGuitarEngine.js. Its audio never touches audioCtx/
    // masterOut; it combines with the drums only at the hardware output
    // (monitoring) and via guitarRecordingTap above (recording).
    const guitar = isTauriRuntime()
      ? new NativeGuitarEngine()
      : new GuitarEngine(audioCtx, masterOut);
    engineRef.current = { audioCtx, masterOut, engine, scheduler, guitar, recorder, guitarRecordingTap };
    engine.loadSamples(DEFAULT_KIT_ID); // no-op falls keine echten Samples vorliegen

    // Debug-Zugriff in der Browser-Konsole (nur Dev-Build), z.B. für
    // Latenz-Diagnose: window.__pocketDrummer.audioCtx.baseLatency /
    // .outputLatency.
    if (import.meta.env.DEV) {
      window.__pocketDrummer = engineRef.current;
    }

    return engineRef.current;
  }, []);

  useEffect(() => {
    engineRef.current?.scheduler.setPattern(patternRef.current);
  }, [pattern]);

  useEffect(() => {
    return () => {
      engineRef.current?.scheduler.stop();
      engineRef.current?.guitar.dispose();
      engineRef.current?.audioCtx.close();
      recordingsRef.current.forEach((r) => URL.revokeObjectURL(r.url));
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
      const { engine } = ensureEngine();
      const kitConfig = getKit(id);
      engine.setKit(kitConfig);
      setKitId(id);
      setIsKitLoading(true);
      await engine.loadSamples(id);
      setIsKitLoading(false);
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
    },
    [ensureEngine]
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
    const { audioCtx, scheduler, recorder, guitar, guitarRecordingTap } = ensureEngine();
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume();
    }
    if (recorder.isRecording) {
      // Native-only — stop capture on the Rust side before finishing the
      // Recorder, so a slightly-lagging drain doesn't hand back guitar
      // audio after the recording's already been closed.
      guitar.setRecordingActive?.(false);
      const blob = await recorder.stop();
      const url = URL.createObjectURL(blob);
      const extension = blob.type.includes('ogg') ? 'ogg' : 'webm';
      const filename = `pocket-drummer-riff-${formatTimestamp()}.${extension}`;
      setRecordings((prev) => [
        { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, url, filename, createdAt: Date.now() },
        ...prev,
      ]);
      setIsRecording(false);
    } else {
      guitarRecordingTap.reset();
      guitar.setRecordingActive?.(true);
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
  }, [ensureEngine]);

  // Native-only (NativeGuitarEngine.drainAudio) — polls captured post-FX
  // guitar audio while recording and feeds it into guitarRecordingTap, so
  // the recorded file contains guitar as well as drums (see
  // GuitarRecordingTap.js for why this can't just be masterOut). No-op
  // for the browser GuitarEngine, whose audio already reaches
  // recordingDestination directly via masterOut.
  useEffect(() => {
    if (!isRecording || !guitarConnected) return undefined;
    const { guitar, guitarRecordingTap } = engineRef.current ?? {};
    if (!guitar?.drainAudio) return undefined;
    const id = setInterval(async () => {
      const chunk = await guitar.drainAudio();
      if (chunk?.samples?.length) {
        guitarRecordingTap.pushSamples(chunk.samples, chunk.sampleRate);
      }
    }, 50);
    return () => clearInterval(id);
  }, [isRecording, guitarConnected]);

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

  const deleteRecording = useCallback((id) => {
    setRecordings((prev) => {
      const target = prev.find((r) => r.id === id);
      if (target) URL.revokeObjectURL(target.url);
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
  };
}
