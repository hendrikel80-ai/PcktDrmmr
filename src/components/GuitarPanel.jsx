import { useState } from 'react';
import guitarIcon from '../assets/icon-guitar.png';
import { formatError } from '../utils/formatError';

export default function GuitarPanel({
  supported,
  connected,
  devices,
  selectedDeviceId,
  onConnect,
  onDisconnect,
  onRefreshDevices,
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
          <img src={guitarIcon} alt="" className="instrument-card__icon" />
        </div>
        <h3 className="instrument-card__title">Guitar</h3>
        <p className="instrument-card__hint">Browser doesn't support getUserMedia.</p>
      </div>
    );
  }

  return (
    <div className="instrument-card">
      <div className="instrument-card__header">
        <img src={guitarIcon} alt="" className="instrument-card__icon" />
        <span className={`instrument-card__status${connected ? ' instrument-card__status--connected' : ''}`} />
      </div>
      <h3 className="instrument-card__title">Guitar</h3>
      <p className="instrument-card__subtitle">Electric Guitar</p>

      <div className="guitar-panel__row">
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
      </div>
      {error && <span className="guitar-panel__error">{error}</span>}
    </div>
  );
}
