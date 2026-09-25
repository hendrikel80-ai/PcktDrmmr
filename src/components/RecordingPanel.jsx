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

// A take made with "Loop recording" on gets "-loop" in its filename (see
// useAudioEngine.js) — used to default its playback to looping too,
// otherwise the whole point of trimming it to a clean bar boundary is
// lost the moment you actually listen to it.
function isLoopTake(filename) {
  return typeof filename === 'string' && filename.includes('-loop');
}

// The editable part of a recording's name — the extension is always kept
// (see useAudioEngine.js's renameRecording), so only the base name is
// shown/edited here.
function baseName(filename) {
  const dotIndex = filename.lastIndexOf('.');
  return dotIndex >= 0 ? filename.slice(0, dotIndex) : filename;
}

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
  onRename,
  onArchive,
  loopEnabled,
  onLoopEnabledChange,
  syncOffsetMs,
  onSyncOffsetChange,
}) {
  const [count, setCount] = useState(null); // null = no count-in active, otherwise 1..beatsPerBar
  const [elapsedMs, setElapsedMs] = useState(0);
  const startedAtRef = useRef(null);
  // Per-recording playback-loop override (id -> boolean). Defaults to
  // isLoopTake(filename) when a take has no explicit override yet, so
  // "Loop recording" takes actually loop on play without extra clicks,
  // while still letting the user flip it either way per take.
  const [loopPlaybackOverrides, setLoopPlaybackOverrides] = useState({});
  // Inline rename of one recording at a time (no native prompt() —
  // unreliable inside Tauri's webview), keyed by id since the list renders
  // every recording at once, unlike a single-selection dropdown.
  const [renamingId, setRenamingId] = useState(null);
  const [renameText, setRenameText] = useState('');
  const [renameError, setRenameError] = useState('');
  // Archived recordings stay in the `recordings` prop, just hidden here by
  // default — this toggles a separate view to bring one back.
  const [showArchived, setShowArchived] = useState(false);

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

  function handleStartRename(r) {
    setRenamingId(r.id);
    setRenameText(baseName(r.filename));
    setRenameError('');
  }

  function handleCancelRename() {
    setRenamingId(null);
    setRenameError('');
  }

  async function handleConfirmRename(e) {
    e.preventDefault();
    const result = await onRename(renamingId, renameText);
    if (!result?.ok) {
      setRenameError(result?.error || 'Renaming failed.');
      return;
    }
    setRenamingId(null);
    setRenameError('');
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

      {(() => {
        const visibleRecordings = recordings.filter((r) => !r.archived);
        const archivedRecordings = recordings.filter((r) => r.archived);
        return (
          <>
            {visibleRecordings.length > 0 && (
              <ul className="recording-panel__list">
                {visibleRecordings.map((r) => {
                  const loopPlayback = loopPlaybackOverrides[r.id] ?? isLoopTake(r.filename);
                  return (
                    <li key={r.id} className="recording-panel__item">
                      <audio controls loop={loopPlayback} src={r.url} className="recording-panel__audio" />
                      <label className="recording-panel__loop-playback" title="Loop this recording during playback">
                        <input
                          type="checkbox"
                          checked={loopPlayback}
                          onChange={(e) =>
                            setLoopPlaybackOverrides((o) => ({ ...o, [r.id]: e.target.checked }))
                          }
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
                          aria-hidden="true"
                        >
                          <polyline points="17 1 21 5 17 9" />
                          <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                          <polyline points="7 23 3 19 7 15" />
                          <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                        </svg>
                      </label>

                      {r.id === renamingId ? (
                        <form className="recording-panel__rename-form" onSubmit={handleConfirmRename}>
                          <input
                            type="text"
                            className="pattern-manager__name-input"
                            value={renameText}
                            onChange={(e) => setRenameText(e.target.value)}
                            maxLength={80}
                            autoFocus
                          />
                          <button type="submit" className="pattern-manager__save-btn" disabled={!renameText.trim()}>
                            Save
                          </button>
                          <button type="button" className="pattern-manager__save-btn" onClick={handleCancelRename}>
                            Cancel
                          </button>
                          {renameError && <span className="prompt-bar__error">{renameError}</span>}
                        </form>
                      ) : (
                        <>
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
                          {onRename && (
                            <button
                              type="button"
                              className="recording-panel__delete"
                              onClick={() => handleStartRename(r)}
                              title="Rename"
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
                                aria-hidden="true"
                              >
                                <path d="M12 20h9" />
                                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                              </svg>
                            </button>
                          )}
                          {onArchive && (
                            <button
                              type="button"
                              className="recording-panel__delete"
                              onClick={() => onArchive(r.id, true)}
                              title="Hide from this list without deleting the file"
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
                                aria-hidden="true"
                              >
                                <rect x="3" y="4" width="18" height="4" rx="1" />
                                <path d="M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8" />
                                <path d="M10 13h4" />
                              </svg>
                            </button>
                          )}
                          <button
                            type="button"
                            className="recording-panel__delete"
                            onClick={() => onDelete(r.id)}
                            title={r.path ? 'Deletes the file from disk' : 'Remove from the list'}
                          >
                            🗑
                          </button>
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            {onArchive && (archivedRecordings.length > 0 || showArchived) && (
              <div className="recording-panel__archived">
                <label className="guitar-panel__latency-toggle">
                  <input
                    type="checkbox"
                    checked={showArchived}
                    onChange={(e) => setShowArchived(e.target.checked)}
                  />
                  Show archived ({archivedRecordings.length})
                </label>
                {showArchived &&
                  (archivedRecordings.length === 0 ? (
                    <p className="instrument-card__hint">No archived recordings.</p>
                  ) : (
                    <ul className="recording-panel__archived-list">
                      {archivedRecordings.map((r) => (
                        <li key={r.id} className="recording-panel__archived-item">
                          <span className="recording-panel__archived-name">{r.filename}</span>
                          <button
                            type="button"
                            className="pattern-manager__load-btn"
                            onClick={() => onArchive(r.id, false)}
                          >
                            Unarchive
                          </button>
                        </li>
                      ))}
                    </ul>
                  ))}
              </div>
            )}
          </>
        );
      })()}
    </div>
  );
}
