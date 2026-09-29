import NumberStepper from './NumberStepper';

const BPM_MIN = 40;
const BPM_MAX = 300;
const BARS_MIN = 1;
const BARS_MAX = 8; // matches validatePattern.js's own bars bound

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
  return (
    <div className="transport">
      <button
        type="button"
        className={['transport__play', isPlaying ? 'transport__play--active' : ''].filter(Boolean).join(' ')}
        onClick={onToggle}
      >
        {isPlaying ? '⏸ Stop' : '▶ Play'}
      </button>
      <NumberStepper value={bpm} onChange={onBpmChange} min={BPM_MIN} max={BPM_MAX} unit="BPM" ariaLabel="BPM" />
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
        <div className="transport__drum-volume" title="Drum volume — how loud the drums sit in the mix">
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
          <span className="transport__bpm-unit">Drums</span>
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
