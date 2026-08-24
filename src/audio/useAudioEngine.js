import { useEffect, useRef, useState, useCallback } from 'react';
import { HybridDrumEngine } from './HybridDrumEngine';
import { GuitarEngine } from './GuitarEngine';
import { Recorder } from './Recorder';
import { Scheduler } from './Scheduler';
import { DEFAULT_KIT_ID, getKit } from '../data/kits';
import * as ampLibrary from '../data/ampLibrary';

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
  const lastModelTextRef = useRef(null); // Rohtext des zuletzt geladenen .nam-Modells (für "In Bibliothek speichern")
  const lastIRBufferRef = useRef(null); // ArrayBuffer der zuletzt geladenen Cabinet-IR
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [kitId, setKitId] = useState(DEFAULT_KIT_ID);
  const [isKitLoading, setIsKitLoading] = useState(false);
  const [guitarConnected, setGuitarConnected] = useState(false);
  const [guitarDevices, setGuitarDevices] = useState([]);
  const [selectedGuitarDeviceId, setSelectedGuitarDeviceId] = useState(null);
  const [guitarModelInfo, setGuitarModelInfo] = useState(null);
  const [hasCabinetIR, setHasCabinetIR] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordings, setRecordings] = useState([]);
  const [libraryModels, setLibraryModels] = useState([]);
  const [libraryIRs, setLibraryIRs] = useState([]);

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
    const guitar = new GuitarEngine(audioCtx, masterOut);
    engineRef.current = { audioCtx, masterOut, engine, scheduler, guitar, recorder };
    engine.loadSamples(DEFAULT_KIT_ID); // no-op falls keine echten Samples vorliegen

    // Debug-Zugriff in der Browser-Konsole (nur Dev-Build), z.B. für
    // Latenz-Diagnose: window.__pocketDrummer.audioCtx.baseLatency /
    // .outputLatency, oder window.__pocketDrummer.guitar.namNode.
    if (import.meta.env.DEV) {
      window.__pocketDrummer = engineRef.current;
    }

    return engineRef.current;
  }, []);

  useEffect(() => {
    engineRef.current?.scheduler.setPattern(patternRef.current);
  }, [pattern]);

  useEffect(() => {
    if (!ampLibrary.isSupported()) return;
    ampLibrary.listModels().then(setLibraryModels);
    ampLibrary.listIRs().then(setLibraryIRs);
  }, []);

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

  const disconnectGuitar = useCallback(() => {
    engineRef.current?.guitar.disconnectInput();
    setGuitarConnected(false);
  }, []);

  const refreshGuitarDevices = useCallback(async () => {
    const guitar = engineRef.current?.guitar;
    if (!guitar) return;
    setGuitarDevices(await guitar.listInputDevices());
  }, []);

  const loadGuitarModel = useCallback(async (file) => {
    const guitar = engineRef.current?.guitar;
    if (!guitar) throw new Error('Erst Gitarren-Eingang verbinden.');
    const json = await file.text();
    const info = await guitar.loadModel(json);
    lastModelTextRef.current = json;
    setGuitarModelInfo({ name: file.name, ...info });
  }, []);

  const loadCabinetIR = useCallback(async (file) => {
    const { audioCtx, guitar } = ensureEngine();
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    lastIRBufferRef.current = arrayBuffer;
    guitar.loadCabinetIR(audioBuffer);
    setHasCabinetIR(true);
  }, [ensureEngine]);

  // --- Lokale Amp-Bibliothek (IndexedDB) ---

  const refreshLibrary = useCallback(async () => {
    if (!ampLibrary.isSupported()) return;
    setLibraryModels(await ampLibrary.listModels());
    setLibraryIRs(await ampLibrary.listIRs());
  }, []);

  const saveCurrentModelToLibrary = useCallback(
    async (name) => {
      if (!lastModelTextRef.current) throw new Error('Kein Amp-Modell geladen.');
      await ampLibrary.saveModel({ name, namText: lastModelTextRef.current });
      await refreshLibrary();
    },
    [refreshLibrary]
  );

  const loadModelFromLibrary = useCallback(async (id) => {
    const guitar = engineRef.current?.guitar;
    if (!guitar) throw new Error('Erst Gitarren-Eingang verbinden.');
    const entry = await ampLibrary.getModel(id);
    if (!entry) throw new Error('Modell nicht gefunden.');
    const info = await guitar.loadModel(entry.namText);
    lastModelTextRef.current = entry.namText;
    setGuitarModelInfo({ name: entry.name, ...info });
  }, []);

  const deleteLibraryModel = useCallback(
    async (id) => {
      await ampLibrary.deleteModel(id);
      await refreshLibrary();
    },
    [refreshLibrary]
  );

  const saveCurrentIRToLibrary = useCallback(
    async (name) => {
      if (!lastIRBufferRef.current) throw new Error('Keine Cabinet-IR geladen.');
      await ampLibrary.saveIR({ name, arrayBuffer: lastIRBufferRef.current });
      await refreshLibrary();
    },
    [refreshLibrary]
  );

  const loadIRFromLibrary = useCallback(
    async (id) => {
      const { audioCtx, guitar } = ensureEngine();
      const entry = await ampLibrary.getIR(id);
      if (!entry) throw new Error('IR nicht gefunden.');
      // decodeAudioData "verbraucht" den Buffer (detached nach Gebrauch) — Kopie nehmen,
      // damit die Bibliothek den Original-Buffer für spätere Ladevorgänge behält.
      const audioBuffer = await audioCtx.decodeAudioData(entry.arrayBuffer.slice(0));
      lastIRBufferRef.current = entry.arrayBuffer;
      guitar.loadCabinetIR(audioBuffer);
      setHasCabinetIR(true);
    },
    [ensureEngine]
  );

  const deleteLibraryIR = useCallback(
    async (id) => {
      await ampLibrary.deleteIR(id);
      await refreshLibrary();
    },
    [refreshLibrary]
  );

  const clearCabinetIR = useCallback(() => {
    engineRef.current?.guitar.clearCabinetIR();
    lastIRBufferRef.current = null;
    setHasCabinetIR(false);
  }, []);

  const setGuitarInputGain = useCallback((value) => {
    engineRef.current?.guitar.setInputGain(value);
  }, []);

  const setGuitarOutputGain = useCallback((value) => {
    engineRef.current?.guitar.setOutputGain(value);
  }, []);

  const toggleRecording = useCallback(async () => {
    const { audioCtx, recorder } = ensureEngine();
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume();
    }
    if (recorder.isRecording) {
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
      recorder.start();
      setIsRecording(true);
    }
  }, [ensureEngine]);

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
    guitarSupported: GuitarEngine.isSupported(),
    guitarConnected,
    guitarDevices,
    selectedGuitarDeviceId,
    guitarModelInfo,
    hasCabinetIR,
    connectGuitar,
    disconnectGuitar,
    refreshGuitarDevices,
    loadGuitarModel,
    loadCabinetIR,
    clearCabinetIR,
    setGuitarInputGain,
    setGuitarOutputGain,
    recordingSupported: Recorder.isSupported(),
    isRecording,
    recordings,
    toggleRecording,
    deleteRecording,
    librarySupported: ampLibrary.isSupported(),
    libraryModels,
    libraryIRs,
    saveCurrentModelToLibrary,
    loadModelFromLibrary,
    deleteLibraryModel,
    saveCurrentIRToLibrary,
    loadIRFromLibrary,
    deleteLibraryIR,
  };
}
