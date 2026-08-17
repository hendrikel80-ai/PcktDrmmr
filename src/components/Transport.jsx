export default function Transport({ isPlaying, onToggle, bpm, onBpmChange, styleDescription }) {
  return (
    <div className="transport">
      <button type="button" className="transport__play" onClick={onToggle}>
        {isPlaying ? '⏸ Stop' : '▶ Play'}
      </button>
      <label className="transport__bpm">
        BPM
        <input
          type="range"
          min={40}
          max={300}
          value={bpm}
          onChange={(e) => onBpmChange(Number(e.target.value))}
        />
        <span>{bpm}</span>
      </label>
      {styleDescription && <div className="transport__style">{styleDescription}</div>}
    </div>
  );
}
