import { useEffect, useState } from 'react';
import { DEFAULT_PATTERN } from '../data/defaultPattern';
import { resizePatternBars } from '../data/resizePattern';
import { useMobileAudioEngine } from '../audio/useMobileAudioEngine';
import { isTextEntryTarget } from '../utils/isTextEntryTarget';
import StepSequencer from './StepSequencer';
import Transport from './Transport';
import PromptBar from './PromptBar';
import LibraryBrowser from './LibraryBrowser';
import KitSelector from './KitSelector';
import PatternManager from './PatternManager';
import MobileMicPanel from './MobileMicPanel';
import RecordingPanel from './RecordingPanel';
import InfoDialog from './InfoDialog';
import FeedbackButton from './FeedbackButton';
import logo from '../assets/pocket-studio-logo.png';
import drumkitIcon from '../assets/icon-drumkit.png';

// Schlanke Mobile-App: Drums + Mikrofon-Aufnahme, kein Gitarren-Amp/ASIO/
// Tuner/Sound-Like/Sync-Offset (siehe Plan "Pocket Studio Mobile"). Nutzt
// den eigenen useMobileAudioEngine-Hook statt useAudioEngine.js.
const MAX_PATTERN_HISTORY = 50;

export default function MobileApp() {
  const [pattern, setPatternState] = useState(DEFAULT_PATTERN);
  const [patternHistory, setPatternHistory] = useState([]);
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

  // Tracked setter — see App.jsx's identical pattern for why BPM changes
  // bypass it (setPatternState directly) while grid edits/Clear/bar-count
  // changes/pattern loads go through it.
  function setPattern(updater) {
    setPatternState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (next === prev) return prev;
      setPatternHistory((h) => [...h, prev].slice(-MAX_PATTERN_HISTORY));
      return next;
    });
  }

  function handleUndo() {
    if (patternHistory.length === 0) return;
    const previous = patternHistory[patternHistory.length - 1];
    setPatternHistory((h) => h.slice(0, -1));
    setPatternState(previous);
  }

  useEffect(() => {
    function handleKeyDown(e) {
      if (isTextEntryTarget(document.activeElement)) return;
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [patternHistory]);

  function handleBpmChange(bpm) {
    setPatternState((p) => ({ ...p, bpm }));
  }

  function handleBarsChange(newBars) {
    setPattern((p) => resizePatternBars(p, newBars));
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
        <LibraryBrowser onLoad={handleLoadPattern} />

        <Transport
          isPlaying={isPlaying}
          onToggle={toggle}
          bpm={pattern.bpm}
          onBpmChange={handleBpmChange}
          bars={pattern.bars}
          onBarsChange={handleBarsChange}
          styleDescription={pattern.style_description}
        />

        <PatternManager
          pattern={pattern}
          onLoad={handleLoadPattern}
          onClear={handleClearPattern}
          canUndo={patternHistory.length > 0}
          onUndo={handleUndo}
        />

        <StepSequencer pattern={pattern} currentStep={currentStep} onChange={setPattern} />
      </section>

      <footer className="app__footer">
        <p>Tap steps to program them (Off → Ghost → Normal → Accent).</p>
        <div className="app__footer-links">
          <FeedbackButton platform="Mobile" />
          <InfoDialog />
        </div>
      </footer>
    </div>
  );
}
