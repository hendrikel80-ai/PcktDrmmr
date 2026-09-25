import { useEffect, useRef, useState } from 'react';
import { DEFAULT_PATTERN } from './data/defaultPattern';
import { resizePatternBars } from './data/resizePattern';
import { loadPattern as loadSavedPattern } from './data/patternStorage';
import { useAudioEngine } from './audio/useAudioEngine';
import StepSequencer from './components/StepSequencer';
import Transport from './components/Transport';
import PromptBar from './components/PromptBar';
import LibraryBrowser from './components/LibraryBrowser';
import KitSelector from './components/KitSelector';
import PatternManager from './components/PatternManager';
import ArrangementEditor from './components/ArrangementEditor';
import GuitarPanel from './components/GuitarPanel';
import MicPanel from './components/MicPanel';
import AmpPanel from './components/AmpPanel';
import SoundLike from './components/SoundLike';
import RecordingPanel from './components/RecordingPanel';
import AsioSettingsDialog from './components/AsioSettingsDialog';
import InfoDialog from './components/InfoDialog';
import FeedbackButton from './components/FeedbackButton';
import { isTauriRuntime } from './utils/platform';
import { isTextEntryTarget } from './utils/isTextEntryTarget';
import logo from './assets/pocket-studio-logo.png';
import drumkitIcon from './assets/icon-drumkit.png';

const MAX_PATTERN_HISTORY = 50;

export default function App() {
  const [pattern, setPatternState] = useState(DEFAULT_PATTERN);
  // Undo history for pattern-grid edits (step clicks, Clear, bar-count
  // changes, loading a different pattern) — deliberately NOT for BPM
  // changes (see handleBpmChange below), which would otherwise flood this
  // with one entry per tick while holding the +/- button.
  const [patternHistory, setPatternHistory] = useState([]);
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
    asioDriverName,
    asioGuitarChannel,
    asioMicChannel,
    setAsioSettings,
    probeAsioChannels,
  } = useAudioEngine(pattern);
  const [asioSettingsOpen, setAsioSettingsOpen] = useState(false);

  // Song/Arrangement Mode: an ordered list of {patternName, repeats}
  // entries referencing already-saved patterns (see ArrangementEditor.jsx
  // for the editing UI). Playback advancement lives here, not in
  // useAudioEngine.js/Scheduler.js — it only needs to react to
  // `currentStep` wrapping back to 0 (one full loop of the pattern
  // currently loaded into the scheduler just completed) and then swap in
  // the next entry's pattern via the same setPatternState the rest of
  // this component already uses. Keeping it at this level avoids touching
  // the real-time-adjacent Scheduler code at all.
  const [arrangementEntries, setArrangementEntries] = useState([]);
  const [loopArrangement, setLoopArrangement] = useState(false);
  const [isArrangementPlaying, setIsArrangementPlaying] = useState(false);
  const [arrangementIndex, setArrangementIndex] = useState(0);
  const [arrangementLoopsDone, setArrangementLoopsDone] = useState(0);
  const [arrangementError, setArrangementError] = useState('');
  const prevStepRef = useRef(null);

  // Tracked setter — pushes the pre-edit state onto the undo stack before
  // applying the change. Used for actual grid edits, Clear, bar-count
  // changes, and loading a different pattern; NOT for BPM (see below).
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

  // Detects "the pattern currently loaded into the scheduler just
  // completed one full loop" (currentStep wrapped back to 0, but wasn't
  // already 0 the step before — i.e. not the very first step right after
  // starting) and, only while a song is actually playing, decides whether
  // to count another repeat or advance to the next entry. Deliberately
  // depends on [currentStep] alone, not on arrangementIndex/Entries/etc —
  // this only needs to react to step changes; it always reads the latest
  // values of everything else via closure when it does run (same pattern
  // as the undo keyboard-shortcut effect above).
  useEffect(() => {
    if (!isArrangementPlaying) {
      prevStepRef.current = null;
      return;
    }
    // null means "no step observed yet since the song (re)started" — the
    // very first onStep(0) call after start() must NOT count as a wrap,
    // or the first entry would immediately "complete" before playing a
    // single beat. Only currentStep returning to 0 after having been
    // something else counts as a genuine completed loop.
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
    const nextPattern = loadSavedPattern(arrangementEntries[nextIndex].patternName);
    if (!nextPattern) {
      setArrangementError(`Pattern "${arrangementEntries[nextIndex].patternName}" not found — song stopped.`);
      stop();
      return;
    }
    setArrangementError('');
    setPatternState(nextPattern);
    setArrangementIndex(nextIndex);
    setArrangementLoopsDone(0);
  }, [currentStep]);

  // Centralized reset whenever playback actually stops, regardless of
  // cause (normal Transport Stop, the natural end of a non-looping song,
  // or a missing-pattern error above) — so a stale isArrangementPlaying
  // flag never survives past the audio actually stopping.
  useEffect(() => {
    if (!isPlaying) {
      setIsArrangementPlaying(false);
      setArrangementIndex(0);
      setArrangementLoopsDone(0);
    }
  }, [isPlaying]);

  // Set the instant handlePlaySong needs toggle() to actually start
  // playback — NOT called directly from handlePlaySong itself. toggle()'s
  // "start" branch reads patternRef.current (see useAudioEngine.js),
  // which only reflects the just-set first entry's pattern AFTER React
  // has re-rendered with it; calling toggle() synchronously in the same
  // handler as setPatternState() would still see the *previous* pattern
  // and briefly play the wrong section. Routing the actual start through
  // this effect (which only runs after that re-render has committed)
  // avoids the race entirely.
  const [pendingSongStart, setPendingSongStart] = useState(false);
  useEffect(() => {
    if (!pendingSongStart) return;
    setPendingSongStart(false);
    toggle();
  }, [pendingSongStart]);

  function handlePlaySong() {
    if (arrangementEntries.length === 0) return;
    const firstPattern = loadSavedPattern(arrangementEntries[0].patternName);
    if (!firstPattern) {
      setArrangementError(`Pattern "${arrangementEntries[0].patternName}" not found.`);
      return;
    }
    setArrangementError('');
    prevStepRef.current = null;
    setPatternState(firstPattern);
    setArrangementIndex(0);
    setArrangementLoopsDone(0);
    setIsArrangementPlaying(true);
    if (!isPlaying) setPendingSongStart(true);
  }

  function handleStopSong() {
    if (isPlaying) toggle();
  }

  // Bypasses the tracked setter on purpose — BPM changes fire rapidly
  // while the +/- button is held (see Transport.jsx), which would
  // otherwise flood the undo stack with one entry per tick.
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
          showAsioSettings={isTauriRuntime()}
          onOpenAsioSettings={() => setAsioSettingsOpen(true)}
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

      {asioSettingsOpen && (
        <AsioSettingsDialog
          onClose={() => setAsioSettingsOpen(false)}
          drivers={guitarDevices}
          onRefreshDrivers={refreshGuitarDevices}
          currentDriverName={asioDriverName}
          currentGuitarChannel={asioGuitarChannel}
          currentMicChannel={asioMicChannel}
          onProbeChannels={probeAsioChannels}
          onSave={setAsioSettings}
        />
      )}

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
        onSyncOffsetChange={setSyncOffsetMs}
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

        <StepSequencer pattern={pattern} currentStep={currentStep} onChange={setPattern} />
      </section>

      <footer className="app__footer">
        <p>Click steps to program them (Off → Ghost → Normal → Accent).</p>
        <div className="app__footer-links">
          <FeedbackButton platform="Desktop" />
          <InfoDialog />
        </div>
      </footer>
    </div>
  );
}
