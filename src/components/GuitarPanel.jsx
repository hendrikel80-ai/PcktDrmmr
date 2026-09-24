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
  showAsioSettings,
  onOpenAsioSettings,
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
        {showAsioSettings && (
          <button
            type="button"
            className="instrument-card__settings"
            onClick={onOpenAsioSettings}
            aria-label="Audio interface settings"
            title="Audio interface settings"
          >
            <svg
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82A1.65 1.65 0 0 0 3 13.09H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        )}
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
