import { useState } from 'react';
import micIcon from '../assets/icon-mic.png';

// Vocal mic — the Scarlett's second input channel (see MIC_IN_CH in
// asio_engine.rs). Native-only, no browser equivalent, and it rides along
// on the same ASIO session the guitar's "Connect Guitar" button already
// starts (there's no separate hardware device to connect to), so this
// panel just waits for `connected` rather than offering its own connect
// step.
export default function MicPanel({ connected, onMicEnabledChange, onMicGainChange, onMicReverbChange }) {
  const [micEnabled, setMicEnabledState] = useState(false);

  return (
    <div className="instrument-card">
      <div className="instrument-card__header">
        <img src={micIcon} alt="" className="instrument-card__icon" />
        <span className={`instrument-card__status${connected ? ' instrument-card__status--connected' : ''}`} />
      </div>
      <h3 className="instrument-card__title">Microphone</h3>
      <p className="instrument-card__subtitle">Vocals</p>

      {!connected ? (
        <p className="instrument-card__hint">Connect via "Connect Guitar" first to start the interface connection.</p>
      ) : (
        <div className="mic-panel__row">
          <label className="guitar-panel__latency-toggle">
            <input
              type="checkbox"
              checked={micEnabled}
              onChange={(e) => {
                setMicEnabledState(e.target.checked);
                onMicEnabledChange(e.target.checked);
              }}
            />
            Enable
          </label>
          <label title="Level of the mic signal in the mix (independent of the guitar's volume)">
            Gain
            <input
              type="range"
              min={0}
              max={4}
              step={0.1}
              defaultValue={1}
              disabled={!micEnabled}
              onChange={(e) => onMicGainChange(Number(e.target.value))}
            />
          </label>
          <label title="Amount of room reverb mixed into the dry mic signal">
            Reverb
            <input
              type="range"
              min={0}
              max={1}
              step={0.02}
              defaultValue={0.15}
              disabled={!micEnabled}
              onChange={(e) => onMicReverbChange(Number(e.target.value))}
            />
          </label>
        </div>
      )}
    </div>
  );
}
