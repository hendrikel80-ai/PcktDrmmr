import { useEffect, useRef, useState } from 'react';

const BPM_MIN = 40;
const BPM_MAX = 300;
const HOLD_INITIAL_DELAY_MS = 350;
const HOLD_REPEAT_MS = 80;

function clampBpm(value) {
  return Math.min(BPM_MAX, Math.max(BPM_MIN, Math.round(value)));
}

export default function Transport({ isPlaying, onToggle, bpm, onBpmChange, styleDescription }) {
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
      {styleDescription && <div className="transport__style">{styleDescription}</div>}
    </div>
  );
}
