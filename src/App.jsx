import { useState } from 'react';
import { DEFAULT_PATTERN } from './data/defaultPattern';
import { useAudioEngine } from './audio/useAudioEngine';
import StepSequencer from './components/StepSequencer';
import Transport from './components/Transport';
import PromptBar from './components/PromptBar';
import KitSelector from './components/KitSelector';
import MidiOutputSelector from './components/MidiOutputSelector';
import PatternManager from './components/PatternManager';
import GuitarPanel from './components/GuitarPanel';

export default function App() {
  const [pattern, setPattern] = useState(DEFAULT_PATTERN);
  const {
    isPlaying,
    currentStep,
    toggle,
    stop,
    kitId,
    isKitLoading,
    selectKit,
    midiSupported,
    midiEnabled,
    midiOutputs,
    selectedMidiOutputId,
    enableMidi,
    selectMidiOutput,
    refreshMidiOutputs,
    guitarSupported,
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
  } = useAudioEngine(pattern);

  function handleBpmChange(bpm) {
    setPattern((p) => ({ ...p, bpm }));
  }

  function handleLoadPattern(newPattern) {
    stop();
    setPattern(newPattern);
  }

  return (
    <div className="app">
      <header className="app__header">
        <h1>🥁 Pocket Drummer</h1>
        <p className="app__subtitle">Übungsbeats zum Mitspielen — Step-Sequencer</p>
      </header>

      <PromptBar onGenerate={handleLoadPattern} />

      <KitSelector kitId={kitId} isLoading={isKitLoading} onSelect={selectKit} />

      <MidiOutputSelector
        supported={midiSupported}
        enabled={midiEnabled}
        outputs={midiOutputs}
        selectedId={selectedMidiOutputId}
        onEnable={enableMidi}
        onSelect={selectMidiOutput}
        onRefresh={refreshMidiOutputs}
      />

      <GuitarPanel
        supported={guitarSupported}
        connected={guitarConnected}
        devices={guitarDevices}
        selectedDeviceId={selectedGuitarDeviceId}
        modelInfo={guitarModelInfo}
        onConnect={connectGuitar}
        onDisconnect={disconnectGuitar}
        onRefreshDevices={refreshGuitarDevices}
        onLoadModel={loadGuitarModel}
        onLoadCabinetIR={loadCabinetIR}
        onClearCabinetIR={clearCabinetIR}
        onInputGainChange={setGuitarInputGain}
        onOutputGainChange={setGuitarOutputGain}
      />

      <Transport
        isPlaying={isPlaying}
        onToggle={toggle}
        bpm={pattern.bpm}
        onBpmChange={handleBpmChange}
        styleDescription={pattern.style_description}
      />

      <PatternManager pattern={pattern} onLoad={handleLoadPattern} />

      <StepSequencer pattern={pattern} currentStep={currentStep} onChange={setPattern} />

      <footer className="app__footer">
        <p>Steps anklicken zum Programmieren (Aus → Ghost → Normal → Akzent).</p>
      </footer>
    </div>
  );
}
