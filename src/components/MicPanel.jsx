import { useState } from 'react';

// Vocal mic — the Scarlett's second input channel (see MIC_IN_CH in
// asio_engine.rs). Native-only, no browser equivalent, and it rides along
// on the same ASIO session the guitar's "Verbinden" button already starts
// (there's no separate hardware device to connect to), so this panel just
// waits for `connected` rather than offering its own connect step.
export default function MicPanel({ connected, onMicEnabledChange, onMicGainChange, onMicReverbChange }) {
  const [micEnabled, setMicEnabledState] = useState(false);

  if (!connected) {
    return (
      <div className="mic-panel mic-panel--waiting">
        🎤 Mikrofon: erst über "Gitarre verbinden" die Verbindung zum Interface starten.
      </div>
    );
  }

  return (
    <div className="mic-panel">
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
          🎤 Mikrofon
        </label>
        <label title="Pegel des Mikrofonsignals im Mix (unabhängig von der Gitarren-Lautstärke)">
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
        <label title="Anteil des Raumhalls (Reverb), der zum trockenen Mikrofonsignal zugemischt wird">
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
    </div>
  );
}
