import { useEffect, useRef, useState } from 'react';

const HOLD_INITIAL_DELAY_MS = 350;
const HOLD_REPEAT_MS = 80;

function clampValue(value, min, max, decimals) {
  const factor = 10 ** decimals;
  const rounded = Math.round(value * factor) / factor;
  return Math.min(max, Math.max(min, rounded));
}

// A press-and-hold-to-repeat, type-to-enter numeric stepper — the same
// interaction for any bounded number control in this app (BPM, a
// per-song-entry tempo override, a loop-trim point in milliseconds, …) so
// they all behave identically instead of each reimplementing the same
// hold-timer logic. Originally written just for BPM (see Transport.jsx);
// generalized once a second, differently-scaled control (RecordingPanel.jsx's
// loop-trim, stepping in milliseconds) needed the exact same feel.
export default function NumberStepper({
  value,
  onChange,
  min,
  max,
  step = 1,
  decimals = 0,
  unit = '',
  className = '',
  ariaLabel = 'value',
  title,
  // Optional display override for values that don't read naturally as a
  // plain number (e.g. milliseconds shown as MM:SS:mmm) — the underlying
  // value/stepping/clamping stays a plain number either way, only how
  // it's shown/typed changes. Switches the input to type="text" (a
  // formatted string like "0:04:200" isn't a valid type="number" value).
  format: formatOverride,
  parse: parseOverride,
}) {
  const format = formatOverride || ((v) => v.toFixed(decimals));
  const parse = parseOverride || ((t) => parseFloat(t));
  const [text, setText] = useState(format(value));
  // Holds the control's live target across an entire press-and-hold run —
  // `value` itself only updates once per React render, too slow to read
  // inside a fast setInterval tick without risking stale/duplicate steps.
  const valueRef = useRef(value);
  const holdTimeoutRef = useRef(null);
  const holdIntervalRef = useRef(null);

  useEffect(() => {
    valueRef.current = value;
    setText(format(value));
  }, [value]);

  useEffect(() => stopHold, []);

  function commitStep(delta) {
    const next = clampValue(valueRef.current + delta, min, max, decimals);
    valueRef.current = next;
    onChange(next);
  }

  function stopHold() {
    clearTimeout(holdTimeoutRef.current);
    clearInterval(holdIntervalRef.current);
    holdTimeoutRef.current = null;
    holdIntervalRef.current = null;
  }

  function startHold(delta) {
    commitStep(delta);
    holdTimeoutRef.current = setTimeout(() => {
      holdIntervalRef.current = setInterval(() => commitStep(delta), HOLD_REPEAT_MS);
    }, HOLD_INITIAL_DELAY_MS);
  }

  function commitText() {
    const parsed = parse(text);
    if (Number.isFinite(parsed)) {
      const next = clampValue(parsed, min, max, decimals);
      valueRef.current = next;
      onChange(next);
      setText(format(next));
    } else {
      setText(format(value));
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.target.blur();
    } else if (e.key === 'Escape') {
      setText(format(value));
      e.target.blur();
    }
  }

  return (
    <div className={['transport__bpm', className].filter(Boolean).join(' ')} title={title}>
      <button
        type="button"
        className="transport__bpm-step"
        onPointerDown={() => startHold(-step)}
        onPointerUp={stopHold}
        onPointerLeave={stopHold}
        disabled={value <= min}
        aria-label={`Decrease ${ariaLabel}`}
      >
        −
      </button>
      <input
        type={formatOverride ? 'text' : 'number'}
        inputMode={formatOverride ? 'numeric' : undefined}
        className="transport__bpm-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commitText}
        onKeyDown={handleKeyDown}
        step={formatOverride ? undefined : step}
        min={formatOverride ? undefined : min}
        max={formatOverride ? undefined : max}
      />
      {unit && <span className="transport__bpm-unit">{unit}</span>}
      <button
        type="button"
        className="transport__bpm-step"
        onPointerDown={() => startHold(step)}
        onPointerUp={stopHold}
        onPointerLeave={stopHold}
        disabled={value >= max}
        aria-label={`Increase ${ariaLabel}`}
      >
        +
      </button>
    </div>
  );
}
