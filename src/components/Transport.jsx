import { useEffect, useRef, useState } from 'react';

const BPM_MIN = 40;
const BPM_MAX = 300;
const BARS_MIN = 1;
const BARS_MAX = 8; // matches validatePattern.js's own bars bound
const HOLD_INITIAL_DELAY_MS = 350;
const HOLD_REPEAT_MS = 80;

function clampBpm(value) {
  return Math.min(BPM_MAX, Math.max(BPM_MIN, Math.round(value)));
}

export default function Transport({
  isPlaying,
  onToggle,
  bpm,
  onBpmChange,
  bars,
  onBarsChange,
  drumVolume,
  onDrumVolumeChange,
  styleDescription,
}) {
  const [bpmText, setBpmText] = useState(String(bpm));
  // Holds the button's live target across an entire press-and-hold run —
  // `bpm` itself only updates once per React render, too slow to read
  // inside a fast setInterval tick without risking stale/duplicate steps.
  const bpmRef = useRef(bpm);
  const holdTimeoutRef = useRef(null);
  const holdIntervalRef = useRef(null);

  useEffect(() => {
    bpmRef.current = bpm;
    setBpmText(String(bpm));
  }, [bpm]);

  useEffect(() => stopHold, []);

  function step(delta) {
    const next = clampBpm(bpmRef.current + delta);
    bpmRef.current = next;
    onBpmChange(next);
  }

  function stopHold() {
    clearTimeout(holdTimeoutRef.current);
    clearInterval(holdIntervalRef.current);
    holdTimeoutRef.current = null;
    holdIntervalRef.current = null;
  }

  function startHold(delta) {
    step(delta);
    holdTimeoutRef.current = setTimeout(() => {
      holdIntervalRef.current = setInterval(() => step(delta), HOLD_REPEAT_MS);
    }, HOLD_INITIAL_DELAY_MS);
  }

  function commitBpmText() {
    const parsed = parseInt(bpmText, 10);
    if (Number.isFinite(parsed)) {
      const next = clampBpm(parsed);
      bpmRef.current = next;
      onBpmChange(next);
      setBpmText(String(next));
    } else {
      setBpmText(String(bpm));
    }
  }

  function handleBpmKeyDown(e) {
    if (e.key === 'Enter') {
      e.target.blur();
    } else if (e.key === 'Escape') {
      setBpmText(String(bpm));
      e.target.blur();
    }
  }

  return (
    <div className="transport">
      <button
        type="button"
        className={['transport__play', isPlaying ? 'transport__play--active' : ''].filter(Boolean).join(' ')}
        onClick={onToggle}
      >
        {isPlaying ? '⏸ Stop' : '▶ Play'}
      </button>
      <div className="transport__bpm">
        <button
          type="button"
          className="transport__bpm-step"
          onPointerDown={() => startHold(-1)}
          onPointerUp={stopHold}
          onPointerLeave={stopHold}
          disabled={bpm <= BPM_MIN}
          aria-label="Decrease BPM"
        >
          −
        </button>
        <input
          type="number"
          className="transport__bpm-input"
          value={bpmText}
          onChange={(e) => setBpmText(e.target.value)}
          onBlur={commitBpmText}
          onKeyDown={handleBpmKeyDown}
          min={BPM_MIN}
          max={BPM_MAX}
        />
        <span className="transport__bpm-unit">BPM</span>
        <button
          type="button"
          className="transport__bpm-step"
          onPointerDown={() => startHold(1)}
          onPointerUp={stopHold}
          onPointerLeave={stopHold}
          disabled={bpm >= BPM_MAX}
          aria-label="Increase BPM"
        >
          +
        </button>
      </div>
      {onBarsChange && (
        <div className="transport__bpm" title="Number of bars in the current pattern">
          <button
            type="button"
            className="transport__bpm-step"
            onClick={() => onBarsChange(bars - 1)}
            disabled={bars <= BARS_MIN}
            aria-label="Remove a bar"
          >
            −
          </button>
          <span className="transport__bpm-unit">
            {bars} {bars === 1 ? 'Bar' : 'Bars'}
          </span>
          <button
            type="button"
            className="transport__bpm-step"
            onClick={() => onBarsChange(bars + 1)}
            disabled={bars >= BARS_MAX}
            aria-label="Add a bar"
          >
            +
          </button>
        </div>
      )}
      {onDrumVolumeChange && (
        <div className="transport__drum-volume" title="Drum volume">
          <svg
            viewBox="0 0 24 24"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M15.5 8.5a5 5 0 0 1 0 7" />
            <path d="M18.5 5.5a9 9 0 0 1 0 13" />
          </svg>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={drumVolume}
            onChange={(e) => onDrumVolumeChange(Number(e.target.value))}
            aria-label="Drum volume"
          />
          <span className="transport__bpm-unit">{Math.round(drumVolume * 100)}%</span>
        </div>
      )}
      {styleDescription && <div className="transport__style">{styleDescription}</div>}
    </div>
  );
}
