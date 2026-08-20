import { useEffect, useState } from 'react';
import { deletePattern, listPatterns, loadPattern, savePattern } from '../data/patternStorage';

export default function PatternManager({ pattern, onLoad }) {
  const [name, setName] = useState('');
  const [saved, setSaved] = useState([]);
  const [selectedName, setSelectedName] = useState('');

  useEffect(() => {
    refresh();
  }, []);

  function refresh(preferredName) {
    const list = listPatterns();
    setSaved(list);
    if (list.length === 0) {
      setSelectedName('');
    } else if (preferredName && list.some((p) => p.name === preferredName)) {
      setSelectedName(preferredName);
    } else if (!list.some((p) => p.name === selectedName)) {
      setSelectedName(list[0].name);
    }
  }

  function handleSave(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    savePattern(trimmed, pattern);
    setName('');
    refresh(trimmed);
  }

  function handleLoad() {
    const loaded = loadPattern(selectedName);
    if (loaded) onLoad(loaded);
  }

  function handleDelete() {
    if (!selectedName) return;
    deletePattern(selectedName);
    refresh();
  }

  return (
    <div className="pattern-manager">
      <form className="pattern-manager__save" onSubmit={handleSave}>
        <input
          type="text"
          className="pattern-manager__name-input"
          placeholder="Pattern-Name…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
        />
        <button type="submit" className="pattern-manager__save-btn" disabled={!name.trim()}>
          💾 Speichern
        </button>
      </form>

      {saved.length > 0 && (
        <div className="pattern-manager__load">
          <select
            className="pattern-manager__select"
            value={selectedName}
            onChange={(e) => setSelectedName(e.target.value)}
          >
            {saved.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>
          <button type="button" className="pattern-manager__load-btn" onClick={handleLoad}>
            📂 Laden
          </button>
          <button
            type="button"
            className="pattern-manager__delete-btn"
            onClick={handleDelete}
            title="Pattern löschen"
          >
            🗑
          </button>
        </div>
      )}
    </div>
  );
}
