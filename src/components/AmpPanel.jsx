import { useEffect, useState } from 'react';
import ampIcon from '../assets/icon-amp.png';
import { formatError } from '../utils/formatError';
import { deleteAmpPreset, listAmpPresets, loadAmpPreset, saveAmpPreset } from '../data/ampPresetStorage';

const DEFAULT_SETTINGS = {
  gain: 1,
  bass: 0,
  mid: 0,
  treble: 0,
  reverb: 0.15,
  output: 1,
  delayEnabled: false,
  delay: 0.3,
};

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
  const [tunerEnabled, setTunerEnabledState] = useState(false);
  // Controlled, not just fire-and-forget onChange handlers, so a loaded
  // preset can actually move the sliders — the app-level engine state
  // they report to (useAudioEngine.js) has no "current value" of its own
  // to read back from.
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [presets, setPresets] = useState([]);
  const [presetName, setPresetName] = useState('');
  const [selectedPreset, setSelectedPreset] = useState('');

  useEffect(() => {
    if (!connected) setError('');
  }, [connected]);

  useEffect(() => {
    refreshPresets();
  }, []);

  function refreshPresets(preferredName) {
    const list = listAmpPresets();
    setPresets(list);
    if (list.length === 0) {
      setSelectedPreset('');
    } else if (preferredName && list.some((p) => p.name === preferredName)) {
      setSelectedPreset(preferredName);
    } else if (!list.some((p) => p.name === selectedPreset)) {
      setSelectedPreset(list[0].name);
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

  function updateSetting(key, value, onChange) {
    setSettings((s) => ({ ...s, [key]: value }));
    onChange?.(value);
  }

  function handleSavePreset(e) {
    e.preventDefault();
    const trimmed = presetName.trim();
    if (!trimmed) return;
    saveAmpPreset(trimmed, settings);
    setPresetName('');
    refreshPresets(trimmed);
  }

  function handleLoadPreset() {
    const loaded = loadAmpPreset(selectedPreset);
    if (!loaded) return;
    const merged = { ...DEFAULT_SETTINGS, ...loaded };
    setSettings(merged);
    onInputGainChange?.(merged.gain);
    onBassChange?.(merged.bass);
    onMidChange?.(merged.mid);
    onTrebleChange?.(merged.treble);
    onReverbChange?.(merged.reverb);
    onOutputGainChange?.(merged.output);
    onDelayEnabledChange?.(merged.delayEnabled);
    onDelayChange?.(merged.delay);
  }

  function handleDeletePreset() {
    if (!selectedPreset) return;
    deleteAmpPreset(selectedPreset);
    refreshPresets();
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
                max={4}
                step={0.05}
                value={settings.gain}
                onChange={(e) => updateSetting('gain', Number(e.target.value), onInputGainChange)}
              />
            </label>
            <label>
              Bass
              <input
                type="range"
                min={-12}
                max={12}
                step={0.5}
                value={settings.bass}
                onChange={(e) => updateSetting('bass', Number(e.target.value), onBassChange)}
              />
            </label>
            <label>
              Middle
              <input
                type="range"
                min={-12}
                max={12}
                step={0.5}
                value={settings.mid}
                onChange={(e) => updateSetting('mid', Number(e.target.value), onMidChange)}
              />
            </label>
            <label>
              Treble
              <input
                type="range"
                min={-12}
                max={12}
                step={0.5}
                value={settings.treble}
                onChange={(e) => updateSetting('treble', Number(e.target.value), onTrebleChange)}
              />
            </label>
            <label title="Amount of room reverb mixed into the dry signal">
              Reverb
              <input
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={settings.reverb}
                onChange={(e) => updateSetting('reverb', Number(e.target.value), onReverbChange)}
              />
            </label>
            <label>
              Output
              <input
                type="range"
                min={0}
                max={2}
                step={0.05}
                value={settings.output}
                onChange={(e) => updateSetting('output', Number(e.target.value), onOutputGainChange)}
              />
            </label>
          </div>

          {onDelayEnabledChange && (
            <div className="guitar-panel__row">
              <label className="guitar-panel__latency-toggle">
                <input
                  type="checkbox"
                  checked={settings.delayEnabled}
                  onChange={(e) => updateSetting('delayEnabled', e.target.checked, onDelayEnabledChange)}
                />
                <svg
                  viewBox="0 0 24 24"
                  width="13"
                  height="13"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ verticalAlign: '-2px', marginRight: '4px' }}
                  aria-hidden="true"
                >
                  <rect x="3" y="9" width="3" height="6" fill="currentColor" stroke="none" />
                  <rect x="9" y="6" width="3" height="12" fill="currentColor" stroke="none" opacity="0.65" />
                  <rect x="15" y="3" width="3" height="18" fill="currentColor" stroke="none" opacity="0.35" />
                </svg>
                Delay
              </label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={settings.delay}
                disabled={!settings.delayEnabled}
                onChange={(e) => updateSetting('delay', Number(e.target.value), onDelayChange)}
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
                <svg
                  viewBox="0 0 24 24"
                  width="13"
                  height="13"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ verticalAlign: '-2px', marginRight: '4px' }}
                  aria-hidden="true"
                >
                  <path d="M9 2v9a3 3 0 0 0 6 0V2" />
                  <line x1="12" y1="14" x2="12" y2="22" />
                  <line x1="8" y1="22" x2="16" y2="22" />
                </svg>
                Tuner
              </label>
              {tunerEnabled && <TunerDisplay reading={tunerReading} />}
            </div>
          )}

          <form className="pattern-manager__save guitar-panel__row" onSubmit={handleSavePreset}>
            <input
              type="text"
              className="pattern-manager__name-input"
              placeholder="Preset name…"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              maxLength={60}
            />
            <button type="submit" className="pattern-manager__save-btn" disabled={!presetName.trim()}>
              Save Preset
            </button>
          </form>
          {presets.length > 0 && (
            <div className="pattern-manager__load guitar-panel__row">
              <select
                className="pattern-manager__select"
                value={selectedPreset}
                onChange={(e) => setSelectedPreset(e.target.value)}
              >
                {presets.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
              <button type="button" className="pattern-manager__load-btn" onClick={handleLoadPreset}>
                Load
              </button>
              <button
                type="button"
                className="pattern-manager__delete-btn"
                onClick={handleDeletePreset}
                title="Delete preset"
              >
                🗑
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
