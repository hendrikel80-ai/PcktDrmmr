import { useState } from 'react';
import { DEFAULT_PATTERN } from './data/defaultPattern';
import { useAudioEngine } from './audio/useAudioEngine';
import StepSequencer from './components/StepSequencer';
import Transport from './components/Transport';
import PromptBar from './components/PromptBar';
import KitSelector from './components/KitSelector';
import PatternManager from './components/PatternManager';
import GuitarPanel from './components/GuitarPanel';
import RecordingPanel from './components/RecordingPanel';
import AmpLibrary from './components/AmpLibrary';
import AmpFinder from './components/AmpFinder';

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
    recordingSupported,
    isRecording,
    recordings,
    toggleRecording,
    deleteRecording,
    hasCabinetIR,
    librarySupported,
    libraryModels,
    libraryIRs,
    saveCurrentModelToLibrary,
    loadModelFromLibrary,
    deleteLibraryModel,
    saveCurrentIRToLibrary,
    loadIRFromLibrary,
    deleteLibraryIR,
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

      <GuitarPanel
        supported={guitarSupported}
        connected={guitarConnected}
        devices={guitarDevices}
        selectedDeviceId={selectedGuitarDeviceId}
        modelInfo={guitarModelInfo}
        hasCabinetIR={hasCabinetIR}
        onConnect={connectGuitar}
        onDisconnect={disconnectGuitar}
        onRefreshDevices={refreshGuitarDevices}
        onLoadModel={loadGuitarModel}
        onLoadCabinetIR={loadCabinetIR}
        onClearCabinetIR={clearCabinetIR}
        onInputGainChange={setGuitarInputGain}
        onOutputGainChange={setGuitarOutputGain}
      />

      <AmpFinder />

      <AmpLibrary
        supported={librarySupported}
        hasActiveModel={Boolean(guitarModelInfo)}
        hasActiveIR={hasCabinetIR}
        models={libraryModels}
        irs={libraryIRs}
        onSaveModel={saveCurrentModelToLibrary}
        onLoadModel={loadModelFromLibrary}
        onDeleteModel={deleteLibraryModel}
        onSaveIR={saveCurrentIRToLibrary}
        onLoadIR={loadIRFromLibrary}
        onDeleteIR={deleteLibraryIR}
      />

      <Transport
        isPlaying={isPlaying}
        onToggle={toggle}
        bpm={pattern.bpm}
        onBpmChange={handleBpmChange}
        styleDescription={pattern.style_description}
      />

      <PatternManager pattern={pattern} onLoad={handleLoadPattern} />

      <RecordingPanel
        supported={recordingSupported}
        isRecording={isRecording}
        recordings={recordings}
        onToggle={toggleRecording}
        onDelete={deleteRecording}
      />

      <StepSequencer pattern={pattern} currentStep={currentStep} onChange={setPattern} />

      <footer className="app__footer">
        <p>Steps anklicken zum Programmieren (Aus → Ghost → Normal → Akzent).</p>
      </footer>
    </div>
  );
}
