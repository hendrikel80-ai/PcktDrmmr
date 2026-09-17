import { useState } from 'react';
import { DEFAULT_PATTERN } from '../data/defaultPattern';
import { useMobileAudioEngine } from '../audio/useMobileAudioEngine';
import StepSequencer from './StepSequencer';
import Transport from './Transport';
import PromptBar from './PromptBar';
import KitSelector from './KitSelector';
import PatternManager from './PatternManager';
import MobileMicPanel from './MobileMicPanel';
import RecordingPanel from './RecordingPanel';
import logo from '../assets/pocket-studio-logo.png';
import drumkitIcon from '../assets/icon-drumkit.png';

// Schlanke Mobile-App: Drums + Mikrofon-Aufnahme, kein Gitarren-Amp/ASIO/
// Tuner/Sound-Like/Sync-Offset (siehe Plan "Pocket Studio Mobile"). Nutzt
// den eigenen useMobileAudioEngine-Hook statt useAudioEngine.js.
export default function MobileApp() {
  const [pattern, setPattern] = useState(DEFAULT_PATTERN);
  const {
    isPlaying,
    currentStep,
    toggle,
    stop,
    kitId,
    isKitLoading,
    selectKit,
    micSupported,
    micConnected,
    micDevices,
    selectedMicDeviceId,
    connectMic,
    disconnectMic,
    refreshMicDevices,
    setMicInputGain,
    recordingSupported,
    isRecording,
    recordings,
    toggleRecording,
    playCountInClick,
    deleteRecording,
  } = useMobileAudioEngine(pattern);

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
    <div className="app mobile-app">
      <header className="app__header">
        <img src={logo} alt="Pocket Studio" className="app__logo" />
      </header>

      <div className="instrument-grid">
        <MobileMicPanel
          supported={micSupported}
          connected={micConnected}
          devices={micDevices}
          selectedDeviceId={selectedMicDeviceId}
          onConnect={connectMic}
          onDisconnect={disconnectMic}
          onRefreshDevices={refreshMicDevices}
          onInputGainChange={setMicInputGain}
        />
      </div>

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
        <div className="sequencer-section__header">
          <h2 className="drums-section__heading">
            <img src={drumkitIcon} alt="" className="guitar-panel__heading-icon" />
            Drums
          </h2>
          <KitSelector kitId={kitId} isLoading={isKitLoading} onSelect={selectKit} />
        </div>

        <PromptBar onGenerate={handleLoadPattern} />

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
        <p>Tap steps to program them (Off → Ghost → Normal → Accent).</p>
      </footer>
    </div>
  );
}
