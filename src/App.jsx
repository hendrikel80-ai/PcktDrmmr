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
import { isTauriRuntime } from './utils/platform';

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
    setGuitarTunerEnabled,
    tunerReading,
    getLatencyInfo,
    guitarModelInfo,
    loadGuitarModel,
    recordingSupported,
    isRecording,
    recordings,
    toggleRecording,
    playCountInClick,
    deleteRecording,
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

      <GuitarPanel
        supported={guitarSupported}
        connected={guitarConnected}
        devices={guitarDevices}
        selectedDeviceId={selectedGuitarDeviceId}
        onConnect={connectGuitar}
        onDisconnect={disconnectGuitar}
        onRefreshDevices={refreshGuitarDevices}
        onInputGainChange={setGuitarInputGain}
        onOutputGainChange={setGuitarOutputGain}
        onBassChange={setGuitarBass}
        onMidChange={setGuitarMid}
        onTrebleChange={setGuitarTreble}
        onReverbChange={setGuitarReverb}
        onDelayEnabledChange={isTauriRuntime() ? setGuitarDelayEnabled : undefined}
        onDelayChange={setGuitarDelay}
        onTunerEnabledChange={isTauriRuntime() ? setGuitarTunerEnabled : undefined}
        tunerReading={tunerReading}
        onGetLatencyInfo={getLatencyInfo}
        onLoadModel={isTauriRuntime() ? loadGuitarModel : undefined}
        modelInfo={guitarModelInfo}
      />

      <RecordingPanel
        supported={recordingSupported}
        isRecording={isRecording}
        recordings={recordings}
        bpm={pattern.bpm}
        timeSignature={pattern.time_signature}
        onToggle={toggleRecording}
        onCountInClick={playCountInClick}
        onDelete={deleteRecording}
      />

      <section className="drums-section">
        <h2 className="drums-section__heading">🥁 Drums</h2>

        <PromptBar onGenerate={handleLoadPattern} />

        <KitSelector kitId={kitId} isLoading={isKitLoading} onSelect={selectKit} />

        <Transport
          isPlaying={isPlaying}
          onToggle={toggle}
          bpm={pattern.bpm}
          onBpmChange={handleBpmChange}
          styleDescription={pattern.style_description}
        />

        <PatternManager pattern={pattern} onLoad={handleLoadPattern} />

        <StepSequencer pattern={pattern} currentStep={currentStep} onChange={setPattern} />
      </section>

      <footer className="app__footer">
        <p>Steps anklicken zum Programmieren (Aus → Ghost → Normal → Akzent).</p>
      </footer>
    </div>
  );
}
