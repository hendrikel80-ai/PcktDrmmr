import { useEffect, useRef, useState, useCallback } from 'react';
import { HybridDrumEngine } from './HybridDrumEngine';
import { GuitarEngine } from './GuitarEngine';
import { MidiOut } from './MidiOut';
import { Scheduler } from './Scheduler';
import { DEFAULT_KIT_ID, getKit } from '../data/kits';

// Erzeugt AudioContext/Engine/Scheduler lazy beim ersten Play- oder
// Kit-Klick, weil Browser AudioContext ohne vorherige User-Geste blockieren.
export function useAudioEngine(pattern) {
  const engineRef = useRef(null);
  const patternRef = useRef(pattern);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [kitId, setKitId] = useState(DEFAULT_KIT_ID);
  const [isKitLoading, setIsKitLoading] = useState(false);
  const [midiEnabled, setMidiEnabled] = useState(false);
  const [midiOutputs, setMidiOutputs] = useState([]);
  const [selectedMidiOutputId, setSelectedMidiOutputId] = useState(null);
  const [guitarConnected, setGuitarConnected] = useState(false);
  const [guitarDevices, setGuitarDevices] = useState([]);
  const [selectedGuitarDeviceId, setSelectedGuitarDeviceId] = useState(null);
  const [guitarModelInfo, setGuitarModelInfo] = useState(null);

  patternRef.current = pattern;

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

    const engine = new HybridDrumEngine(audioCtx, getKit(DEFAULT_KIT_ID), masterOut);
    const scheduler = new Scheduler(audioCtx, engine);
    scheduler.onStep = (step) => setCurrentStep(step);
    const midiOut = new MidiOut(audioCtx);
    midiOut.onOutputsChanged = (outputs) => setMidiOutputs(outputs);
    scheduler.setMidiOut(midiOut);
    const guitar = new GuitarEngine(audioCtx, masterOut);
    engineRef.current = { audioCtx, masterOut, engine, scheduler, midiOut, guitar };
    engine.loadSamples(DEFAULT_KIT_ID); // no-op falls keine echten Samples vorliegen
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

  const enableMidi = useCallback(async () => {
    const { midiOut } = ensureEngine();
    const outputs = await midiOut.requestAccess(); // wirft bei fehlender Browser-Unterstützung
    setMidiOutputs(outputs);
    setMidiEnabled(true);
    if (outputs.length > 0) {
      midiOut.setOutput(outputs[0].id);
      setSelectedMidiOutputId(outputs[0].id);
    }
  }, [ensureEngine]);

  const selectMidiOutput = useCallback((id) => {
    engineRef.current?.midiOut.setOutput(id);
    setSelectedMidiOutputId(id);
  }, []);

  const refreshMidiOutputs = useCallback(() => {
    const midiOut = engineRef.current?.midiOut;
    if (!midiOut) return;
    setMidiOutputs(midiOut.listOutputs());
  }, []);

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
    setGuitarModelInfo({ name: file.name, ...info });
  }, []);

  const loadCabinetIR = useCallback(async (file) => {
    const { audioCtx, guitar } = ensureEngine();
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    guitar.loadCabinetIR(audioBuffer);
  }, [ensureEngine]);

  const clearCabinetIR = useCallback(() => {
    engineRef.current?.guitar.clearCabinetIR();
  }, []);

  const setGuitarInputGain = useCallback((value) => {
    engineRef.current?.guitar.setInputGain(value);
  }, []);

  const setGuitarOutputGain = useCallback((value) => {
    engineRef.current?.guitar.setOutputGain(value);
  }, []);

  return {
    isPlaying,
    currentStep,
    toggle,
    stop,
    kitId,
    isKitLoading,
    selectKit,
    midiSupported: MidiOut.isSupported(),
    midiEnabled,
    midiOutputs,
    selectedMidiOutputId,
    enableMidi,
    selectMidiOutput,
    refreshMidiOutputs,
    guitarSupported: GuitarEngine.isSupported(),
    guitarConnected,
    guitarDevices,
    selectedGuitarDeviceId,
    guitarModelInfo,
    connectGuitar,
    disconnectGuitar,
    refreshGuitarDevices,
    loadGuitarModel,
    loadCabinetIR,
    clearCabinetIR,
    setGuitarInputGain,
    setGuitarOutputGain,
  };
}
