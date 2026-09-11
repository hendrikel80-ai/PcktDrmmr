import { useState } from 'react';
import { DEFAULT_PATTERN } from './data/defaultPattern';
import { useAudioEngine } from './audio/useAudioEngine';
import StepSequencer from './components/StepSequencer';
import Transport from './components/Transport';
import PromptBar from './components/PromptBar';
import KitSelector from './components/KitSelector';
import PatternManager from './components/PatternManager';
import GuitarPanel from './components/GuitarPanel';
import MicPanel from './components/MicPanel';
import AmpPanel from './components/AmpPanel';
import SoundLike from './components/SoundLike';
import RecordingPanel from './components/RecordingPanel';
import { isTauriRuntime } from './utils/platform';
import logo from './assets/pocket-studio-logo.png';
import drumkitIcon from './assets/icon-drumkit.png';

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
    setMicEnabled,
    setMicGain,
    setMicReverb,
    setGuitarTunerEnabled,
    tunerReading,
    guitarModelInfo,
    loadGuitarModel,
    recordingSupported,
    isRecording,
    recordings,
    toggleRecording,
    playCountInClick,
    deleteRecording,
    loopRecording,
    setLoopRecording,
    syncOffsetMs,
    setSyncOffsetMs,
  } = useAudioEngine(pattern);

  function handleBpmChange(bpm) {
    setPattern((p) => ({ ...p, bpm }));
  }

  function handleLoadPattern(newPattern) {
    stop();
    setPattern(newPattern);
  }

  function handleClearPattern() {
    setPattern((p) => ({
      ...p,
      pattern: Object.fromEntries(
        Object.entries(p.pattern).map(([key, steps]) => [key, steps.map(() => 0)])
      ),
    }));
  }

  return (
    <div className="app">
      <header className="app__header">
        <img src={logo} alt="Pocket Studio" className="app__logo" />
      </header>

      <div className="instrument-grid">
        <GuitarPanel
          supported={guitarSupported}
          connected={guitarConnected}
          devices={guitarDevices}
          selectedDeviceId={selectedGuitarDeviceId}
          onConnect={connectGuitar}
          onDisconnect={disconnectGuitar}
          onRefreshDevices={refreshGuitarDevices}
        />

        {isTauriRuntime() && (
          <MicPanel
            connected={guitarConnected}
            onMicEnabledChange={setMicEnabled}
            onMicGainChange={setMicGain}
            onMicReverbChange={setMicReverb}
          />
        )}

        <AmpPanel
          connected={guitarConnected}
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
          onLoadModel={isTauriRuntime() ? loadGuitarModel : undefined}
          modelInfo={guitarModelInfo}
        />
      </div>

      {isTauriRuntime() && <SoundLike />}

      <PromptBar onGenerate={handleLoadPattern} />

      <RecordingPanel
        supported={recordingSupported}
        isRecording={isRecording}
        recordings={recordings}
        bpm={pattern.bpm}
        timeSignature={pattern.time_signature}
        onToggle={toggleRecording}
        onCountInClick={playCountInClick}
        onDelete={deleteRecording}
        loopEnabled={loopRecording}
        onLoopEnabledChange={setLoopRecording}
        syncOffsetMs={syncOffsetMs}
        onSyncOffsetChange={isTauriRuntime() ? setSyncOffsetMs : undefined}
      />

      <section className="drums-section">
        <div className="sequencer-section__header">
          <h2 className="drums-section__heading">
            <img src={drumkitIcon} alt="" className="guitar-panel__heading-icon" />
            Drums
          </h2>
          <KitSelector kitId={kitId} isLoading={isKitLoading} onSelect={selectKit} />
        </div>

        <Transport
          isPlaying={isPlaying}
          onToggle={toggle}
          bpm={pattern.bpm}
          onBpmChange={handleBpmChange}
          styleDescription={pattern.style_description}
        />

        <PatternManager pattern={pattern} onLoad={handleLoadPattern} onClear={handleClearPattern} />

        <StepSequencer pattern={pattern} currentStep={currentStep} onChange={setPattern} />
      </section>

      <footer className="app__footer">
        <p>Click steps to program them (Off → Ghost → Normal → Accent).</p>
      </footer>
    </div>
  );
}
