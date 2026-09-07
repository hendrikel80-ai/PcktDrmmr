import { useEffect, useState } from 'react';
import onAirIcon from '../assets/icon-onair.png';

// Counts up musically (1, 2, 3, [4]) as a count-in instead of a plain
// "get ready" countdown — the number of counted beats and their tempo
// follow the current pattern's time signature and BPM, so the player can
// come in exactly on beat 1 of the recording.
function beatsPerBarFromTimeSignature(timeSignature) {
  const numerator = parseInt(String(timeSignature).split('/')[0], 10);
  return Number.isFinite(numerator) && numerator > 0 ? numerator : 4;
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
}) {
  const [count, setCount] = useState(null); // null = no count-in active, otherwise 1..beatsPerBar

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
        {counting && <span className="recording-panel__countdown">{count}</span>}
        {isRecording && (
          <span className="recording-panel__live">
            Recording drums (browser) + guitar/mic (native, separate WAV file) …
          </span>
        )}
      </div>

      {recordings.length > 0 && (
        <ul className="recording-panel__list">
          {recordings.map((r) =>
            r.kind === 'native' ? (
              <li key={r.id} className="recording-panel__item">
                <span className="recording-panel__native-info" title={r.path}>
                  🎸🎤 {r.filename}
                  <br />
                  already saved to Downloads
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
