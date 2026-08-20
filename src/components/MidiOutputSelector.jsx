import { useState } from 'react';

export default function MidiOutputSelector({
  supported,
  enabled,
  outputs,
  selectedId,
  onEnable,
  onSelect,
  onRefresh,
}) {
  const [error, setError] = useState('');

  async function handleEnable() {
    setError('');
    try {
      await onEnable();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!supported) {
    return (
      <div className="midi-out midi-out--unsupported">
        MIDI-Ausgang: Browser unterstützt Web MIDI nicht (funktioniert in Chrome/Edge).
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className="midi-out">
        <button type="button" className="midi-out__enable" onClick={handleEnable}>
          🎹 MIDI-Ausgang aktivieren
        </button>
        {error && <span className="midi-out__error">{error}</span>}
      </div>
    );
  }

  return (
    <div className="midi-out">
      <span className="midi-out__label">MIDI-Out</span>
      <select
        className="midi-out__select"
        value={selectedId ?? ''}
        onChange={(e) => onSelect(e.target.value)}
      >
        {outputs.length === 0 && <option value="">Kein MIDI-Port gefunden</option>}
        {outputs.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      <button type="button" className="midi-out__refresh" onClick={onRefresh} title="Ports aktualisieren">
        ⟳
      </button>
    </div>
  );
}
