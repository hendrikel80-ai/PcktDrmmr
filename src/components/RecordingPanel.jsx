import { useEffect, useRef, useState } from 'react';
import { isTextEntryTarget } from '../utils/isTextEntryTarget';

// Counts up musically (1, 2, 3, [4]) as a count-in instead of a plain
// "get ready" countdown — the number of counted beats and their tempo
// follow the current pattern's time signature and BPM, so the player can
// come in exactly on beat 1 of the recording.
function beatsPerBarFromTimeSignature(timeSignature) {
  const numerator = parseInt(String(timeSignature).split('/')[0], 10);
  return Number.isFinite(numerator) && numerator > 0 ? numerator : 4;
}

// Always two full bars of count-in, regardless of time signature — long
// enough to settle into the tempo before playing, without dragging on for
// odd meters with a high beat count.
const COUNT_IN_BARS = 2;

function formatElapsed(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

const WAVE_BARS = Array.from({ length: 7 });

// Purely decorative — its motion is honestly tied to the real `isRecording`
// state (only animates while actually recording), but the bar heights
// don't reflect real input level. A true level meter would need an
// AnalyserNode on the recording stream, which the native ASIO path
// (Tauri) doesn't expose the same way the browser path does.
function WaveBars({ active }) {
  return (
    <div className={`recording-panel__wave${active ? ' recording-panel__wave--active' : ''}`} aria-hidden="true">
      {WAVE_BARS.map((_, i) => (
        <span key={i} className="recording-panel__wave-bar" style={{ animationDelay: `${i * 0.09}s` }} />
      ))}
    </div>
  );
}

export default function RecordingPanel({
  supported,
  isRecording,
  recordings,
  bpm,
  timeSignature,
  onToggle,
  onCountInClick,
  onDelete,
  loopEnabled,
  onLoopEnabledChange,
  syncOffsetMs,
  onSyncOffsetChange,
}) {
  const [count, setCount] = useState(null); // null = no count-in active, otherwise 1..beatsPerBar
  const [elapsedMs, setElapsedMs] = useState(0);
  const startedAtRef = useRef(null);

  const beatsPerBar = beatsPerBarFromTimeSignature(timeSignature);
  const totalCountInBeats = beatsPerBar * COUNT_IN_BARS;
  const beatMs = 60000 / (bpm || 120);

  // One click per counted beat (accent on beat 1 of each bar), then wait
  // beatMs and either advance to the next number or — after the last beat
  // of the second bar — end the count-in and start the actual recording.
  useEffect(() => {
    if (count === null) return undefined;
    onCountInClick?.((count - 1) % beatsPerBar === 0);
    const timer = setTimeout(() => {
      if (count >= totalCountInBeats) {
        setCount(null);
        onToggle();
      } else {
        setCount((c) => c + 1);
      }
    }, beatMs);
    return () => clearTimeout(timer);
  }, [count, beatsPerBar, totalCountInBeats, beatMs, onToggle, onCountInClick]);

  // Real elapsed-time counter, not decorative: starts at 0 the moment
  // recording actually begins, ticks while it's running.
  useEffect(() => {
    if (!isRecording) {
      setElapsedMs(0);
      startedAtRef.current = null;
      return undefined;
    }
    startedAtRef.current = Date.now();
    const interval = setInterval(() => {
      setElapsedMs(Date.now() - startedAtRef.current);
    }, 250);
    return () => clearInterval(interval);
  }, [isRecording]);

  // Global Start/Stop-Recording shortcuts — Right Arrow starts (with the
  // usual count-in), Left Arrow stops. Ignored while the user is typing
  // somewhere (pattern name, BPM field, …) so normal cursor movement in
  // those fields still works; ArrowRight also does nothing once already
  // recording/counting in (it's a start action, not a toggle) and
  // ArrowLeft does nothing while not recording.
  useEffect(() => {
    if (!supported) return undefined;
    function handleKeyDown(e) {
      if (isTextEntryTarget(document.activeElement)) return;
      if (e.key === 'ArrowRight') {
        if (isRecording || count !== null) return;
        e.preventDefault();
        setCount(1);
      } else if (e.key === 'ArrowLeft') {
        if (!isRecording) return;
        e.preventDefault();
        onToggle();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [supported, isRecording, count, onToggle]);

  if (!supported) {
    return (
      <div className="recording-panel recording-panel--unsupported">
        Recording: browser doesn't support MediaRecorder.
      </div>
    );
  }

  function handleToggleClick() {
    if (isRecording) {
      onToggle();
      return;
    }
    if (count !== null) return; // count-in already running
    setCount(1);
  }

  const counting = count !== null;

  return (
    <div className="recording-panel">
      <h2 className="drums-section__heading">Recording</h2>
      <div className="recording-panel__row">
        <div className="recording-panel__main">
          {onLoopEnabledChange && (
            <label
              className="guitar-panel__latency-toggle"
              title="Trim the recording to the end of the last full bar, so it loops cleanly"
            >
              <input
                type="checkbox"
                checked={loopEnabled}
                disabled={isRecording || counting}
                onChange={(e) => onLoopEnabledChange(e.target.checked)}
              />
              <svg
                viewBox="0 0 24 24"
                width="13"
                height="13"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ verticalAlign: '-2px', marginRight: '4px' }}
                aria-hidden="true"
              >
                <polyline points="17 1 21 5 17 9" />
                <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                <polyline points="7 23 3 19 7 15" />
                <path d="M21 13v2a4 4 0 0 1-4 4H3" />
              </svg>
              Loop recording
            </label>
          )}
          <WaveBars active={isRecording} />
          <button
            type="button"
            className={[
              'recording-panel__toggle',
              isRecording ? 'recording-panel__toggle--active' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={handleToggleClick}
            disabled={counting}
          >
            <span className="recording-panel__toggle-dot" aria-hidden="true" />
            {isRecording ? 'Stop Recording' : 'Start Recording'}
          </button>
          <WaveBars active={isRecording} />

          {counting && (
            <span className="recording-panel__countdown">{((count - 1) % beatsPerBar) + 1}</span>
          )}

          {isRecording && (
            <div className="recording-panel__timer">
              <span className="recording-panel__timer-time">{formatElapsed(elapsedMs)}</span>
              <button
                type="button"
                className="recording-panel__timer-stop"
                onClick={onToggle}
                aria-label="Stop recording"
                title="Stop recording"
              >
                ■
              </button>
            </div>
          )}
        </div>
      </div>

      {isRecording && (
        <span className="recording-panel__live">
          Recording drums (browser) + guitar/mic (native — includes drums too when a kit's loaded natively) …
        </span>
      )}

      {onSyncOffsetChange && (
        <div className="recording-panel__sync">
          <label
            htmlFor="recording-sync-offset"
            title="Shifts the guitar/mic track relative to the drums. Positive = delay guitar/mic (use if it comes in too early); negative = delay the drums instead (use if guitar/mic still comes in too late after the automatic latency compensation)."
          >
            <svg
              viewBox="0 0 24 24"
              width="13"
              height="13"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ verticalAlign: '-2px', marginRight: '4px' }}
              aria-hidden="true"
            >
              <line x1="4" y1="21" x2="4" y2="14" />
              <line x1="4" y1="10" x2="4" y2="3" />
              <line x1="12" y1="21" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12" y2="3" />
              <line x1="20" y1="21" x2="20" y2="16" />
              <line x1="20" y1="12" x2="20" y2="3" />
              <line x1="1" y1="14" x2="7" y2="14" />
              <line x1="9" y1="8" x2="15" y2="8" />
              <line x1="17" y1="16" x2="23" y2="16" />
            </svg>
            Guitar/Mic Sync
          </label>
          <input
            id="recording-sync-offset"
            type="range"
            min={-100}
            max={100}
            step={1}
            value={syncOffsetMs}
            onChange={(e) => onSyncOffsetChange(Number(e.target.value))}
          />
          <span className="recording-panel__sync-value">
            {syncOffsetMs > 0 ? '+' : ''}
            {syncOffsetMs} ms
          </span>
        </div>
      )}

      {recordings.length > 0 && (
        <ul className="recording-panel__list">
          {recordings.map((r) => (
            <li key={r.id} className="recording-panel__item">
              <audio controls src={r.url} className="recording-panel__audio" />
              <a href={r.url} download={r.filename} className="recording-panel__download">
                <svg
                  viewBox="0 0 24 24"
                  width="13"
                  height="13"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ verticalAlign: '-2px', marginRight: '4px' }}
                  aria-hidden="true"
                >
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                  <polyline points="17 21 17 13 7 13 7 21" />
                  <polyline points="7 3 7 8 15 8" />
                </svg>
                {r.filename}
              </a>
              <button
                type="button"
                className="recording-panel__delete"
                onClick={() => onDelete(r.id)}
                title={r.path ? 'Deletes the file from disk' : 'Remove from the list'}
              >
                🗑
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
