import { useState } from 'react';
import { formatError } from '../utils/formatError';

// Manual ASIO driver + guitar/mic channel-mapping picker — the app can't
// reliably guess which physical input a guitar vs. a mic is plugged into
// on an arbitrary interface, so this replaces what used to be hardcoded
// GUITAR_IN_CH/MIC_IN_CH constants tuned only for the dev's own Scarlett
// Solo (see asio_engine.rs). Modeled on SoundLike.jsx's modal (reuses its
// CSS classes) and GuitarPanel.jsx's existing device <select> pattern.
//
// Doesn't reconnect an already-open session on save — channel/driver
// changes only take effect on the next Connect Guitar click, same as
// picking a different device in the plain-browser fallback already works.
const GENERIC_CHANNEL_FALLBACK_COUNT = 8;

export default function AsioSettingsDialog({
  onClose,
  drivers,
  onRefreshDrivers,
  currentDriverName,
  currentGuitarChannel,
  currentMicChannel,
  onProbeChannels,
  onSave,
}) {
  const [selectedDriver, setSelectedDriver] = useState(currentDriverName ?? '');
  const [guitarChannel, setGuitarChannel] = useState(currentGuitarChannel);
  const [micChannel, setMicChannel] = useState(currentMicChannel);
  // null = not (yet) probed successfully — channel pickers fall back to a
  // generic 0-7 range rather than blocking on a probe that may be flaky.
  const [numInputs, setNumInputs] = useState(null);
  const [probing, setProbing] = useState(false);
  const [error, setError] = useState('');

  async function handleProbe() {
    if (!selectedDriver) return;
    setError('');
    setProbing(true);
    try {
      const info = await onProbeChannels(selectedDriver);
      setNumInputs(info.numInputs);
    } catch (err) {
      setError(formatError(err));
      setNumInputs(null);
    } finally {
      setProbing(false);
    }
  }

  function handleSave() {
    onSave({
      driverName: selectedDriver || null,
      guitarChannel: Number(guitarChannel),
      micChannel: Number(micChannel),
    });
    onClose();
  }

  const channelOptions = Array.from(
    { length: numInputs ?? GENERIC_CHANNEL_FALLBACK_COUNT },
    (_, i) => i
  );

  return (
    <div className="sound-like-modal__backdrop" onClick={onClose}>
      <div className="sound-like-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sound-like-modal__header">
          <h3>Audio Interface Settings</h3>
          <button type="button" className="sound-like-modal__close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="guitar-panel__row">
          <select
            className="guitar-panel__select"
            value={selectedDriver}
            onChange={(e) => {
              setSelectedDriver(e.target.value);
              setNumInputs(null);
            }}
            onFocus={onRefreshDrivers}
          >
            <option value="">Use default (Focusrite, if found)</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="guitar-panel__connect"
            onClick={handleProbe}
            disabled={!selectedDriver || probing}
          >
            {probing ? 'Detecting…' : 'Detect Channels'}
          </button>
        </div>

        {error && (
          <p className="sound-like-modal__link-error">
            {error} — pick a channel manually below (0-{GENERIC_CHANNEL_FALLBACK_COUNT - 1}) instead.
          </p>
        )}

        <div className="guitar-panel__row">
          <label>
            Guitar Input Channel
            <select
              className="guitar-panel__select"
              value={guitarChannel}
              onChange={(e) => setGuitarChannel(e.target.value)}
            >
              {channelOptions.map((ch) => (
                <option key={ch} value={ch}>
                  Channel {ch + 1}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="guitar-panel__row">
          <label>
            Mic Input Channel
            <select
              className="guitar-panel__select"
              value={micChannel}
              onChange={(e) => setMicChannel(e.target.value)}
            >
              {channelOptions.map((ch) => (
                <option key={ch} value={ch}>
                  Channel {ch + 1}
                </option>
              ))}
            </select>
          </label>
        </div>

        <p className="sound-like-modal__hint">
          Saving doesn't reconnect automatically — disconnect and reconnect the guitar afterward to
          apply these settings.
        </p>

        <button type="button" className="recording-panel__toggle" onClick={handleSave}>
          Save
        </button>
      </div>
    </div>
  );
}
