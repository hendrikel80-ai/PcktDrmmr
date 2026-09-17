import { useState } from 'react';
import micIcon from '../assets/icon-mic.png';
import { formatError } from '../utils/formatError';

// Geräteauswahl + Connect/Disconnect + ein Pegel-Regler, sonst nichts —
// kein Amp-Bezug (siehe MicEngine.js). Struktur angelehnt an
// GuitarPanel.jsx, aber eigenständig für die Mobile-App.
export default function MobileMicPanel({
  supported,
  connected,
  devices,
  selectedDeviceId,
  onConnect,
  onDisconnect,
  onRefreshDevices,
  onInputGainChange,
}) {
  const [error, setError] = useState('');

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

  if (!supported) {
    return (
      <div className="instrument-card">
        <div className="instrument-card__header">
          <img src={micIcon} alt="" className="instrument-card__icon" />
        </div>
        <h3 className="instrument-card__title">Microphone</h3>
        <p className="instrument-card__hint">Browser doesn't support microphone access.</p>
      </div>
    );
  }

  return (
    <div className="instrument-card">
      <div className="instrument-card__header">
        <img src={micIcon} alt="" className="instrument-card__icon" />
        <span className={`instrument-card__status${connected ? ' instrument-card__status--connected' : ''}`} />
      </div>
      <h3 className="instrument-card__title">Microphone</h3>
      <p className="instrument-card__subtitle">Acoustic guitar via mic</p>

      <div className="guitar-panel__row">
        {!connected ? (
          <button type="button" className="guitar-panel__connect" onClick={handleConnect}>
            Connect Microphone
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
      </div>

      {connected && (
        <label className="mic-panel__row" title="Input level, no tone shaping">
          Gain
          <input
            type="range"
            min={0}
            max={4}
            step={0.1}
            defaultValue={1}
            onChange={(e) => onInputGainChange(Number(e.target.value))}
          />
        </label>
      )}

      {error && <span className="guitar-panel__error">{error}</span>}
    </div>
  );
}
