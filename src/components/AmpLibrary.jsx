import { useState } from 'react';

export default function AmpLibrary({
  supported,
  hasActiveModel,
  hasActiveIR,
  models,
  irs,
  onSaveModel,
  onLoadModel,
  onDeleteModel,
  onSaveIR,
  onLoadIR,
  onDeleteIR,
}) {
  const [modelName, setModelName] = useState('');
  const [irName, setIrName] = useState('');
  const [error, setError] = useState('');

  if (!supported) {
    return (
      <div className="amp-library amp-library--unsupported">
        Amp-Bibliothek: Browser unterstützt IndexedDB nicht.
      </div>
    );
  }

  async function handleSaveModel(e) {
    e.preventDefault();
    const trimmed = modelName.trim();
    if (!trimmed) return;
    setError('');
    try {
      await onSaveModel(trimmed);
      setModelName('');
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSaveIR(e) {
    e.preventDefault();
    const trimmed = irName.trim();
    if (!trimmed) return;
    setError('');
    try {
      await onSaveIR(trimmed);
      setIrName('');
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleLoadModel(id) {
    setError('');
    try {
      await onLoadModel(id);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleLoadIR(id) {
    setError('');
    try {
      await onLoadIR(id);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="amp-library">
      <div className="amp-library__section">
        <span className="amp-library__label">🎛 Amp-Modelle</span>
        {hasActiveModel && (
          <form className="amp-library__save" onSubmit={handleSaveModel}>
            <input
              type="text"
              placeholder="Name für aktuelles Modell…"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              maxLength={60}
            />
            <button type="submit" disabled={!modelName.trim()}>
              💾 Speichern
            </button>
          </form>
        )}
        {models.length > 0 && (
          <ul className="amp-library__list">
            {models.map((m) => (
              <li key={m.id} className="amp-library__item">
                <span className="amp-library__item-name">{m.name}</span>
                <button type="button" onClick={() => handleLoadModel(m.id)}>
                  📂 Laden
                </button>
                <button type="button" onClick={() => onDeleteModel(m.id)} title="Löschen">
                  🗑
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="amp-library__section">
        <span className="amp-library__label">🔊 Cabinet-IRs</span>
        {hasActiveIR && (
          <form className="amp-library__save" onSubmit={handleSaveIR}>
            <input
              type="text"
              placeholder="Name für aktuelle IR…"
              value={irName}
              onChange={(e) => setIrName(e.target.value)}
              maxLength={60}
            />
            <button type="submit" disabled={!irName.trim()}>
              💾 Speichern
            </button>
          </form>
        )}
        {irs.length > 0 && (
          <ul className="amp-library__list">
            {irs.map((ir) => (
              <li key={ir.id} className="amp-library__item">
                <span className="amp-library__item-name">{ir.name}</span>
                <button type="button" onClick={() => handleLoadIR(ir.id)}>
                  📂 Laden
                </button>
                <button type="button" onClick={() => onDeleteIR(ir.id)} title="Löschen">
                  🗑
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && <span className="amp-library__error">{error}</span>}
    </div>
  );
}
