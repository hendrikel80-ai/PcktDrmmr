// Schlanker Audio-Hook für die Mobile-App (Handy/Tablet, reiner Browser-
// Betrieb, kein Tauri/ASIO) — komponiert Drum-Engine + Mikrofon-Eingang +
// Aufnahme nach demselben Muster wie useAudioEngine.js's ensureEngine()/
// toggleRecording(), aber ohne jede Tauri-/ASIO-/Gitarren-Amp-/Tuner-/
// Sync-Offset-Logik (siehe Plan "Pocket Studio Mobile"). Bewusst als
// eigener, unabhängiger Hook statt useAudioEngine.js mitzunutzen, damit der
// bestehende Desktop-Pfad dort unangetastet bleibt.

import { useEffect, useRef, useState, useCallback } from 'react';
import { HybridDrumEngine } from './HybridDrumEngine';
import { MicEngine } from './MicEngine';
import { Recorder } from './Recorder';
import { Scheduler } from './Scheduler';
import { DEFAULT_KIT_ID, getKit } from '../data/kits';

function formatTimestamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(
    date.getHours()
  )}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}

// Erzeugt AudioContext/Engine/Scheduler lazy beim ersten Play- oder
// Kit-Klick, weil Browser AudioContext ohne vorherige User-Geste blockieren
// (gleiche Begründung wie useAudioEngine.js).
export function useMobileAudioEngine(pattern) {
  const engineRef = useRef(null);
  const patternRef = useRef(pattern);
  const recordingsRef = useRef([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [kitId, setKitId] = useState(DEFAULT_KIT_ID);
  const [isKitLoading, setIsKitLoading] = useState(false);
  const [micConnected, setMicConnected] = useState(false);
  const [micDevices, setMicDevices] = useState([]);
  const [selectedMicDeviceId, setSelectedMicDeviceId] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordings, setRecordings] = useState([]);

  patternRef.current = pattern;
  recordingsRef.current = recordings;

  const ensureEngine = useCallback(() => {
    if (engineRef.current) return engineRef.current;
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)({
      latencyHint: 'interactive',
    });

    // Drums-Ausgang: geht auf den Lautsprecher, damit man dazu spielen
    // kann, UND in den Recording-Bus.
    const masterOut = audioCtx.createGain();
    masterOut.connect(audioCtx.destination);

    // Separater Recording-Bus statt Mikrofon direkt auf masterOut zu
    // routen: masterOut geht auf den Lautsprecher, und ein offenes Handy-
    // Mikrofon direkt neben genau diesem Lautsprecher erzeugt sofort
    // Feedback (hört sich selbst), sobald es mit auf denselben Bus läuft —
    // per Nutzer-Test bestätigt ("das Mikrofon hat voll Feedback"). Drums
    // sollen weiterhin hörbar UND aufgenommen werden (masterOut -> beides),
    // das Mikrofon dagegen nur aufgenommen, nie zurück auf den Lautsprecher
    // gegeben — genau wie jede normale Diktier-/Recording-App das macht.
    const recordingBus = audioCtx.createGain();
    masterOut.connect(recordingBus);

    const recordingDestination = audioCtx.createMediaStreamDestination();
    recordingBus.connect(recordingDestination);
    const recorder = new Recorder(recordingDestination.stream);

    const engine = new HybridDrumEngine(audioCtx, getKit(DEFAULT_KIT_ID), masterOut);
    const scheduler = new Scheduler(audioCtx, engine);
    scheduler.onStep = (step) => setCurrentStep(step);

    const mic = new MicEngine(audioCtx, recordingBus);
    engineRef.current = { audioCtx, masterOut, recordingBus, engine, scheduler, mic, recorder };
    engine.loadSamples(DEFAULT_KIT_ID);

    if (import.meta.env.DEV) {
      window.__pocketStudioMobile = engineRef.current;
    }

    return engineRef.current;
  }, []);

  useEffect(() => {
    engineRef.current?.scheduler.setPattern(patternRef.current);
  }, [pattern]);

  useEffect(() => {
    return () => {
      engineRef.current?.scheduler.stop();
      engineRef.current?.mic.dispose();
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
      const { engine } = ensureEngine();
      engine.setKit(getKit(id));
      setKitId(id);
      setIsKitLoading(true);
      await engine.loadSamples(id);
      setIsKitLoading(false);
    },
    [ensureEngine]
  );

  const connectMic = useCallback(
    async (deviceId) => {
      const { mic } = ensureEngine();
      await mic.connectInput(deviceId); // wirft bei verweigerter/fehlender Berechtigung
      setMicConnected(true);
      setSelectedMicDeviceId(deviceId ?? null);
      const devices = await mic.listInputDevices(); // Labels erst nach erteilter Berechtigung verfügbar
      setMicDevices(devices);
    },
    [ensureEngine]
  );

  const disconnectMic = useCallback(async () => {
    engineRef.current?.mic.disconnectInput();
    setMicConnected(false);
  }, []);

  const refreshMicDevices = useCallback(async () => {
    const mic = engineRef.current?.mic;
    if (!mic) return;
    setMicDevices(await mic.listInputDevices());
  }, []);

  const setMicInputGain = useCallback((value) => {
    engineRef.current?.mic.setInputGain(value);
  }, []);

  const toggleRecording = useCallback(async () => {
    const { audioCtx, scheduler, recorder } = ensureEngine();
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume();
    }
    if (recorder.isRecording) {
      const blob = await recorder.stop();
      setIsRecording(false);
      if (scheduler.isRunning) {
        scheduler.stop();
        setIsPlaying(false);
        setCurrentStep(-1);
      }
      const extension = blob.type.includes('ogg') ? 'ogg' : 'webm';
      const url = URL.createObjectURL(blob);
      const filename = `pocket-studio-mobile-${formatTimestamp()}.${extension}`;
      setRecordings((prev) => [
        { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, url, filename, createdAt: Date.now() },
        ...prev,
      ]);
    } else {
      recorder.start();
      setIsRecording(true);
      // Drums starten zusammen mit der Aufnahme, falls noch nicht am Laufen
      // (gleiches Verhalten wie useAudioEngine.js).
      if (!scheduler.isRunning) {
        scheduler.setPattern(patternRef.current);
        scheduler.start();
        setIsPlaying(true);
      }
    }
  }, [ensureEngine]);

  // Metronom-Klick fürs Count-in von RecordingPanel — direkt auf
  // audioCtx.destination, nicht über masterOut, damit er nie mit
  // aufgenommen wird (gleiche Begründung wie useAudioEngine.js).
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
      if (target?.url) URL.revokeObjectURL(target.url);
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
    micSupported: MicEngine.isSupported(),
    micConnected,
    micDevices,
    selectedMicDeviceId,
    connectMic,
    disconnectMic,
    refreshMicDevices,
    setMicInputGain,
    recordingSupported: Recorder.isSupported(),
    isRecording,
    recordings,
    toggleRecording,
    playCountInClick,
    deleteRecording,
  };
}
