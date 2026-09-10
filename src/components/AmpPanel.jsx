import { useEffect, useState } from 'react';
import ampIcon from '../assets/icon-amp.png';
import { formatError } from '../utils/formatError';

// Cents deviation -50..+50 mapped to a 0-100% position, so the pointer
// sits exactly in the middle of the display at 0 cents.
function TunerDisplay({ reading }) {
  if (!reading) {
    return <span className="guitar-panel__tuner-hint">Play a single string…</span>;
  }
  const clampedCents = Math.max(-50, Math.min(50, reading.cents));
  const pointerPercent = 50 + clampedCents;
  const inTune = Math.abs(reading.cents) < 5;
  return (
    <div className="guitar-panel__tuner-display">
      <span className={`guitar-panel__tuner-note${inTune ? ' guitar-panel__tuner-note--intune' : ''}`}>
        {reading.noteName}
      </span>
      <div className="guitar-panel__tuner-bar">
        <div className="guitar-panel__tuner-bar-center" />
        <div
          className={`guitar-panel__tuner-bar-pointer${inTune ? ' guitar-panel__tuner-bar-pointer--intune' : ''}`}
          style={{ left: `${pointerPercent}%` }}
        />
      </div>
      <span className="guitar-panel__tuner-cents">
        {reading.cents > 0 ? '+' : ''}
        {reading.cents.toFixed(0)}¢
      </span>
    </div>
  );
}

// Tone-shaping controls for the guitar signal — no hardware connection of
// its own (unlike Guitar/Mic), it just rides along on the guitar's
// connection, so `connected` mirrors `guitarConnected` from the parent.
export default function AmpPanel({
  connected,
  onInputGainChange,
  onOutputGainChange,
  onBassChange,
  onMidChange,
  onTrebleChange,
  onReverbChange,
  onDelayEnabledChange,
  onDelayChange,
  onTunerEnabledChange,
  tunerReading,
  onLoadModel,
  modelInfo,
}) {
  const [error, setError] = useState('');
  const [delayEnabled, setDelayEnabledState] = useState(false);
  const [tunerEnabled, setTunerEnabledState] = useState(false);

  useEffect(() => {
    if (!connected) setError('');
  }, [connected]);

  async function handleLoadModel() {
    setError('');
    try {
      await onLoadModel();
    } catch (err) {
      setError(formatError(err));
    }
  }

  return (
    <div className="instrument-card">
      <div className="instrument-card__header">
        <img src={ampIcon} alt="" className="instrument-card__icon" />
        <span className={`instrument-card__status${connected ? ' instrument-card__status--connected' : ''}`} />
      </div>
      <h3 className="instrument-card__title">Amp</h3>
      <p className="instrument-card__subtitle">Bass / Guitar Amp</p>

      {!connected ? (
        <p className="instrument-card__hint">Connect the guitar first to enable amp controls.</p>
      ) : (
        <>
          {onLoadModel && (
            <div className="guitar-panel__row">
              <button type="button" className="guitar-panel__file-btn" onClick={handleLoadModel}>
                🎛 Load NAM Model (.nam)
              </button>
              {modelInfo && (
                <span className="guitar-panel__model-info">
                  {modelInfo.name}
                  {modelInfo.expectedSampleRate > 0 ? ` · ${modelInfo.expectedSampleRate} Hz` : ''}
                </span>
              )}
              {error && <span className="guitar-panel__error">{error}</span>}
            </div>
          )}

          <div className="guitar-panel__row guitar-panel__gains">
            <label title="Level before the distortion stage — higher gain = more saturation, like turning up the gain on a real amp">
              Gain
              <input
                type="range"
                min={0}
                max={8}
                step={0.1}
                defaultValue={1}
                onChange={(e) => onInputGainChange(Number(e.target.value))}
              />
            </label>
            <label>
              Bass
              <input
                type="range"
                min={-12}
                max={12}
                step={0.5}
                defaultValue={0}
                onChange={(e) => onBassChange(Number(e.target.value))}
              />
            </label>
            <label>
              Middle
              <input
                type="range"
                min={-12}
                max={12}
                step={0.5}
                defaultValue={0}
                onChange={(e) => onMidChange(Number(e.target.value))}
              />
            </label>
            <label>
              Treble
              <input
                type="range"
                min={-12}
                max={12}
                step={0.5}
                defaultValue={0}
                onChange={(e) => onTrebleChange(Number(e.target.value))}
              />
            </label>
            <label title="Amount of room reverb mixed into the dry signal">
              Reverb
              <input
                type="range"
                min={0}
                max={1}
                step={0.02}
                defaultValue={0.15}
                onChange={(e) => onReverbChange(Number(e.target.value))}
              />
            </label>
            <label>
              Output
              <input
                type="range"
                min={0}
                max={2}
                step={0.05}
                defaultValue={1}
                onChange={(e) => onOutputGainChange(Number(e.target.value))}
              />
            </label>
          </div>

          {onDelayEnabledChange && (
            <div className="guitar-panel__row">
              <label className="guitar-panel__latency-toggle">
                <input
                  type="checkbox"
                  checked={delayEnabled}
                  onChange={(e) => {
                    setDelayEnabledState(e.target.checked);
                    onDelayEnabledChange(e.target.checked);
                  }}
                />
                🔁 Delay
              </label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.02}
                defaultValue={0.3}
                disabled={!delayEnabled}
                onChange={(e) => onDelayChange(Number(e.target.value))}
              />
            </div>
          )}

          {onTunerEnabledChange && (
            <div className="guitar-panel__row guitar-panel__tuner">
              <label className="guitar-panel__latency-toggle">
                <input
                  type="checkbox"
                  checked={tunerEnabled}
                  onChange={(e) => {
                    setTunerEnabledState(e.target.checked);
                    onTunerEnabledChange(e.target.checked);
                  }}
                />
                🎵 Tuner
              </label>
              {tunerEnabled && <TunerDisplay reading={tunerReading} />}
            </div>
          )}
        </>
      )}
    </div>
  );
}
