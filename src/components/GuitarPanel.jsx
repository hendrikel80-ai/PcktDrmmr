import { useEffect, useState } from 'react';
import SoundLike from './SoundLike';
import guitarIcon from '../assets/icon-guitar.png';

// Tauri command rejections for a Rust `Result<T, String>` reject the JS
// promise with a plain string, not an Error object — err.message on a
// string is always undefined, which was silently swallowing every native
// error here. Handle both shapes.
function formatError(err) {
  if (typeof err === 'string') return err;
  return err?.message || String(err);
}

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

export default function GuitarPanel({
  supported,
  connected,
  devices,
  selectedDeviceId,
  onConnect,
  onDisconnect,
  onRefreshDevices,
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
  onGetLatencyInfo,
  onLoadModel,
  modelInfo,
}) {
  const [error, setError] = useState('');
  const [latencyInfo, setLatencyInfo] = useState(null);
  const [delayEnabled, setDelayEnabledState] = useState(false);
  const [tunerEnabled, setTunerEnabledState] = useState(false);

  function refreshLatency() {
    setLatencyInfo(onGetLatencyInfo());
  }

  useEffect(() => {
    if (connected) refreshLatency();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  async function handleConnect() {
    setError('');
    try {
      await onConnect();
    } catch (err) {
      setError(formatError(err));
    }
  }

  async function handleDeviceChange(e) {
    setError('');
    try {
      await onConnect(e.target.value);
    } catch (err) {
      setError(formatError(err));
    }
  }

  async function handleLoadModel() {
    setError('');
    try {
      await onLoadModel();
    } catch (err) {
      setError(formatError(err));
    }
  }

  if (!supported) {
    return (
      <div className="guitar-panel guitar-panel--unsupported">
        Guitar input: browser doesn't support getUserMedia.
      </div>
    );
  }

  return (
    <div className="guitar-panel">
      <div className="guitar-panel__row">
        <img src={guitarIcon} alt="Guitar" className="guitar-panel__heading-icon" />
        {!connected ? (
          <button type="button" className="guitar-panel__connect" onClick={handleConnect}>
            Connect Guitar
          </button>
        ) : (
          <>
            <select
              className="guitar-panel__select"
              value={selectedDeviceId ?? ''}
              onChange={handleDeviceChange}
              onFocus={onRefreshDevices}
            >
              {devices.length === 0 && <option value="">No input found</option>}
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <button type="button" className="guitar-panel__disconnect" onClick={onDisconnect}>
              Disconnect
            </button>
          </>
        )}
        {error && <span className="guitar-panel__error">{error}</span>}
      </div>

      {onLoadModel && <SoundLike />}

      {connected && onLoadModel && (
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
        </div>
      )}

      {connected && (
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
      )}

      {connected && onDelayEnabledChange && (
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

      {connected && onTunerEnabledChange && (
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
          {tunerEnabled && (
            <TunerDisplay reading={tunerReading} />
          )}
        </div>
      )}

    </div>
  );
}
