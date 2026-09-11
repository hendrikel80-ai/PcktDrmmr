import { useEffect, useRef, useState } from 'react';
import onAirIcon from '../assets/icon-onair.png';

// Counts up musically (1, 2, 3, [4]) as a count-in instead of a plain
// "get ready" countdown — the number of counted beats and their tempo
// follow the current pattern's time signature and BPM, so the player can
// come in exactly on beat 1 of the recording.
function beatsPerBarFromTimeSignature(timeSignature) {
  const numerator = parseInt(String(timeSignature).split('/')[0], 10);
  return Number.isFinite(numerator) && numerator > 0 ? numerator : 4;
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
  loopEnabled,
  onLoopEnabledChange,
  syncOffsetMs,
  onSyncOffsetChange,
}) {
  const [count, setCount] = useState(null); // null = no count-in active, otherwise 1..beatsPerBar
  const [elapsedMs, setElapsedMs] = useState(0);
  const startedAtRef = useRef(null);

  const beatsPerBar = beatsPerBarFromTimeSignature(timeSignature);
  const beatMs = 60000 / (bpm || 120);

  // One click per counted beat (accent on "1"), then wait beatMs and
  // either advance to the next number or — after the last beat — end the
  // count-in and start the actual recording.
  useEffect(() => {
    if (count === null) return undefined;
    onCountInClick?.(count === 1);
    const timer = setTimeout(() => {
      if (count >= beatsPerBar) {
        setCount(null);
        onToggle();
      } else {
        setCount((c) => c + 1);
      }
    }, beatMs);
    return () => clearTimeout(timer);
  }, [count, beatsPerBar, beatMs, onToggle, onCountInClick]);

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
      <div className="recording-panel__row">
        <img src={onAirIcon} alt="Recording" className="guitar-panel__heading-icon" />

        <div className="recording-panel__main">
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
            🔁 Loop recording
          </label>
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
            {isRecording ? '⏹ Stop Recording' : 'Start Recording'}
          </button>
          <WaveBars active={isRecording} />

          {counting && <span className="recording-panel__countdown">{count}</span>}

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
            title="Shifts the guitar/mic track relative to the drums in the merged recording. Positive = delay guitar/mic (use if it comes in too early); negative = delay the drums instead (use if guitar/mic comes in too late)."
          >
            🎯 Guitar/Mic Sync
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
          {recordings.map((r) =>
            r.kind === 'native' ? (
              <li key={r.id} className="recording-panel__item">
                <span className="recording-panel__native-info" title={r.path}>
                  {r.includesDrums ? '🥁🎸🎤' : '🎸🎤'} {r.filename}
                  <br />
                  {r.includesDrums
                    ? 'complete take (drums+guitar/mic, natively synced) — already saved to Downloads'
                    : 'already saved to Downloads'}
                </span>
                <button
                  type="button"
                  className="recording-panel__delete"
                  onClick={() => onDelete(r.id)}
                  title="Only removes this from the list (the file stays in Downloads)"
                >
                  🗑
                </button>
              </li>
            ) : (
              <li key={r.id} className="recording-panel__item">
                <audio controls src={r.url} className="recording-panel__audio" />
                <a href={r.url} download={r.filename} className="recording-panel__download">
                  💾 {r.filename}
                </a>
                <button
                  type="button"
                  className="recording-panel__delete"
                  onClick={() => onDelete(r.id)}
                  title="Remove from the list"
                >
                  🗑
                </button>
              </li>
            )
          )}
        </ul>
      )}
    </div>
  );
}
