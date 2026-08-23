import { useEffect, useState } from 'react';

const COUNTDOWN_START = 4;
const COUNTDOWN_STEP_MS = 700;

export default function RecordingPanel({ supported, isRecording, recordings, onToggle, onDelete }) {
  const [countdown, setCountdown] = useState(null); // null = kein Countdown aktiv, sonst 4..0

  // Zählt countdown jede COUNTDOWN_STEP_MS runter; bei < 0 endet der
  // Countdown und die eigentliche Aufnahme startet erst jetzt.
  useEffect(() => {
    if (countdown === null) return;
    if (countdown < 0) {
      setCountdown(null);
      onToggle();
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), COUNTDOWN_STEP_MS);
    return () => clearTimeout(timer);
  }, [countdown, onToggle]);

  if (!supported) {
    return (
      <div className="recording-panel recording-panel--unsupported">
        Aufnahme: Browser unterstützt MediaRecorder nicht.
      </div>
    );
  }

  function handleToggleClick() {
    if (isRecording) {
      onToggle();
      return;
    }
    if (countdown !== null) return; // Countdown läuft schon
    setCountdown(COUNTDOWN_START);
  }

  const counting = countdown !== null;

  return (
    <div className="recording-panel">
      <div className="recording-panel__row">
        {counting && <span className="recording-panel__countdown">{countdown}</span>}
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
          {isRecording ? '⏹ Aufnahme stoppen' : '🔴 Aufnahme starten'}
        </button>
        {isRecording && (
          <span className="recording-panel__live">Nimmt Drums + Gitarre (gemeinsamer Ausgang) auf …</span>
        )}
      </div>

      {recordings.length > 0 && (
        <ul className="recording-panel__list">
          {recordings.map((r) => (
            <li key={r.id} className="recording-panel__item">
              <audio controls src={r.url} className="recording-panel__audio" />
              <a href={r.url} download={r.filename} className="recording-panel__download">
                💾 {r.filename}
              </a>
              <button
                type="button"
                className="recording-panel__delete"
                onClick={() => onDelete(r.id)}
                title="Aus der Liste entfernen"
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
