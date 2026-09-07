import playIcon from '../assets/icon-play.png';

export default function Transport({ isPlaying, onToggle, bpm, onBpmChange, styleDescription }) {
  return (
    <div className="transport">
      <div className="transport__play-row">
        <img src={playIcon} alt="" className="guitar-panel__heading-icon" />
        <button
          type="button"
          className={['transport__play', isPlaying ? 'transport__play--active' : ''].filter(Boolean).join(' ')}
          onClick={onToggle}
        >
          {isPlaying ? '⏸ Stop' : 'Play'}
        </button>
      </div>
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
