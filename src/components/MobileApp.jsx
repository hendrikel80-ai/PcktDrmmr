import { useEffect, useRef, useState } from 'react';
import { DEFAULT_PATTERN } from '../data/defaultPattern';
import { resizePatternBars } from '../data/resizePattern';
import { loadPattern as loadSavedPattern } from '../data/patternStorage';
import { useMobileAudioEngine } from '../audio/useMobileAudioEngine';
import { isTextEntryTarget } from '../utils/isTextEntryTarget';
import StepSequencer from './StepSequencer';
import Transport from './Transport';
import PromptBar from './PromptBar';
import LibraryBrowser from './LibraryBrowser';
import KitSelector from './KitSelector';
import PatternManager from './PatternManager';
import ArrangementEditor from './ArrangementEditor';
import ViewModeToggle from './ViewModeToggle';
import MobileMicPanel from './MobileMicPanel';
import RecordingPanel from './RecordingPanel';
import InfoDialog from './InfoDialog';
import FeedbackButton from './FeedbackButton';
import { readStoredViewMode, writeViewMode, VIEW_MODES } from '../utils/viewMode';
import logo from '../assets/pocket-studio-logo.png';
import drumkitIcon from '../assets/icon-drumkit.png';

// Schlanke Mobile-App: Drums + Mikrofon-Aufnahme, kein Gitarren-Amp/ASIO/
// Tuner/Sound-Like/Sync-Offset (siehe Plan "Pocket Studio Mobile"). Nutzt
// den eigenen useMobileAudioEngine-Hook statt useAudioEngine.js.
const MAX_PATTERN_HISTORY = 50;

// See App.jsx's identical helper.
function applyEntryBpm(pattern, entry) {
  return entry?.bpm ? { ...pattern, bpm: entry.bpm } : pattern;
}

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
    renameRecording,
    setRecordingArchived,
    drumVolume,
    setDrumVolume,
  } = useMobileAudioEngine(pattern);

  // Jam (simple) vs. Songwriting (full page, including Build a Song) — see
  // App.jsx's identical block.
  const [viewMode, setViewModeState] = useState(readStoredViewMode);
  function setViewMode(mode) {
    setViewModeState(mode);
    writeViewMode(mode);
  }

  // Song/Arrangement Mode — see App.jsx's identical block for the full
  // reasoning (playback advancement lives at this level, reacting to
  // currentStep wrapping back to 0, rather than inside
  // useMobileAudioEngine.js/Scheduler.js).
  const [arrangementEntries, setArrangementEntries] = useState([]);
  const [loopArrangement, setLoopArrangement] = useState(false);
  const [isArrangementPlaying, setIsArrangementPlaying] = useState(false);
  const [arrangementIndex, setArrangementIndex] = useState(0);
  const [arrangementLoopsDone, setArrangementLoopsDone] = useState(0);
  const [arrangementError, setArrangementError] = useState('');
  const prevStepRef = useRef(null);

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

  useEffect(() => {
    if (!isArrangementPlaying) {
      prevStepRef.current = null;
      return;
    }
    const prev = prevStepRef.current;
    prevStepRef.current = currentStep;
    const wrapped = prev !== null && currentStep === 0 && prev !== 0;
    if (!wrapped) return;

    const entry = arrangementEntries[arrangementIndex];
    if (!entry) return;

    const loopsDone = arrangementLoopsDone + 1;
    if (loopsDone < entry.repeats) {
      setArrangementLoopsDone(loopsDone);
      return;
    }

    const atEnd = arrangementIndex + 1 >= arrangementEntries.length;
    const nextIndex = atEnd ? (loopArrangement ? 0 : null) : arrangementIndex + 1;
    if (nextIndex === null) {
      stop();
      return;
    }
    const nextEntry = arrangementEntries[nextIndex];
    const nextPattern = loadSavedPattern(nextEntry.patternName);
    if (!nextPattern) {
      setArrangementError(`Pattern "${nextEntry.patternName}" not found — song stopped.`);
      stop();
      return;
    }
    setArrangementError('');
    setPatternState(applyEntryBpm(nextPattern, nextEntry));
    setArrangementIndex(nextIndex);
    setArrangementLoopsDone(0);
  }, [currentStep]);

  useEffect(() => {
    if (!isPlaying) {
      setIsArrangementPlaying(false);
      setArrangementIndex(0);
      setArrangementLoopsDone(0);
    }
  }, [isPlaying]);

  const [pendingSongStart, setPendingSongStart] = useState(false);
  useEffect(() => {
    if (!pendingSongStart) return;
    setPendingSongStart(false);
    toggle();
  }, [pendingSongStart]);

  function handlePlaySong() {
    if (arrangementEntries.length === 0) return;
    const firstEntry = arrangementEntries[0];
    const firstPattern = loadSavedPattern(firstEntry.patternName);
    if (!firstPattern) {
      setArrangementError(`Pattern "${firstEntry.patternName}" not found.`);
      return;
    }
    setArrangementError('');
    prevStepRef.current = null;
    setPatternState(applyEntryBpm(firstPattern, firstEntry));
    setArrangementIndex(0);
    setArrangementLoopsDone(0);
    setIsArrangementPlaying(true);
    if (!isPlaying) setPendingSongStart(true);
  }

  function handleStopSong() {
    if (isPlaying) toggle();
  }

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
        onRename={renameRecording}
        onArchive={setRecordingArchived}
      />

      <ViewModeToggle mode={viewMode} onChange={setViewMode} />

      <section className="drums-section">
        <div className="sequencer-section__header">
          <h2 className="drums-section__heading">
            <img src={drumkitIcon} alt="" className="guitar-panel__heading-icon" />
            Drums
          </h2>
          <KitSelector kitId={kitId} isLoading={isKitLoading} onSelect={selectKit} />
        </div>

        {viewMode === VIEW_MODES.JAM && (
          <>
            <PromptBar onGenerate={handleLoadPattern} />
            <LibraryBrowser onLoad={handleLoadPattern} />

            <div className="section-frame">
              <h3 className="section-frame__heading">Build a Beat</h3>
              <PatternManager
                pattern={pattern}
                onLoad={handleLoadPattern}
                onClear={handleClearPattern}
                canUndo={patternHistory.length > 0}
                onUndo={handleUndo}
              />
            </div>
          </>
        )}

        {viewMode === VIEW_MODES.SONGWRITING && (
          <ArrangementEditor
            entries={arrangementEntries}
            onEntriesChange={setArrangementEntries}
            loopArrangement={loopArrangement}
            onLoopArrangementChange={setLoopArrangement}
            onPlaySong={handlePlaySong}
            onStopSong={handleStopSong}
            isArrangementPlaying={isArrangementPlaying}
            activeIndex={arrangementIndex}
            activeLoopsDone={arrangementLoopsDone}
            error={arrangementError}
          />
        )}

        <Transport
          isPlaying={isPlaying}
          onToggle={toggle}
          bpm={pattern.bpm}
          onBpmChange={handleBpmChange}
          bars={pattern.bars}
          onBarsChange={handleBarsChange}
          drumVolume={drumVolume}
          onDrumVolumeChange={setDrumVolume}
          styleDescription={pattern.style_description}
        />

        <div className="sequencer__hint">
          <span>Tap steps to cycle through:</span>
          <span className="sequencer__hint-legend">
            <span className="sequencer__hint-swatch" style={{ background: 'var(--step-off)' }} />
            Off
            <span
              className="sequencer__hint-swatch"
              style={{ background: 'color-mix(in srgb, var(--accent) 31%, var(--step-beat))' }}
            />
            Ghost
            <span
              className="sequencer__hint-swatch"
              style={{ background: 'color-mix(in srgb, var(--accent) 75%, var(--step-beat))' }}
            />
            Normal
            <span
              className="sequencer__hint-swatch"
              style={{ background: 'color-mix(in srgb, var(--accent) 98%, var(--step-beat))' }}
            />
            Accent
          </span>
        </div>

        <StepSequencer pattern={pattern} currentStep={currentStep} onChange={setPattern} />
      </section>

      <footer className="app__footer">
        <div className="app__footer-links">
          <FeedbackButton platform="Mobile" />
          <InfoDialog />
        </div>
      </footer>
    </div>
  );
}
