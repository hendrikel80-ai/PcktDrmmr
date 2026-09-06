import { useEffect, useState } from 'react';

// Zählt als musikalisches Einzählen hoch (1, 2, 3, [4]) statt als reiner
// "Achtung gleich geht's los"-Countdown runter — Anzahl der Zählschläge
// und ihr Tempo richten sich nach Taktart und BPM des aktuellen Patterns,
// damit der Spieler exakt auf Schlag 1 der Aufnahme einsteigen kann.
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
  const [count, setCount] = useState(null); // null = kein Einzählen aktiv, sonst 1..beatsPerBar

  const beatsPerBar = beatsPerBarFromTimeSignature(timeSignature);
  const beatMs = 60000 / (bpm || 120);

  // Ein Klick pro Zählschlag (Akzent auf "1"), danach beatMs warten und
  // entweder zur nächsten Zahl weiterzählen oder — nach dem letzten
  // Schlag — den Countdown beenden und die eigentliche Aufnahme starten.
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
        Aufnahme: Browser unterstützt MediaRecorder nicht.
      </div>
    );
  }

  function handleToggleClick() {
    if (isRecording) {
      onToggle();
      return;
    }
    if (count !== null) return; // Einzählen läuft schon
    setCount(1);
  }

  const counting = count !== null;

  return (
    <div className="recording-panel">
      <div className="recording-panel__row">
        {counting && <span className="recording-panel__countdown">{count}</span>}
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
