import { useEffect, useState } from 'react';
import { deletePattern, listPatterns, loadPattern, savePattern, setPatternReference } from '../data/patternStorage';
import { downloadPatternAsMidi } from '../audio/midiExport';

export default function PatternManager({ pattern, onLoad, onClear }) {
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

  function handleReferenceToggle(e) {
    if (!selectedName) return;
    setPatternReference(selectedName, e.target.checked);
    refresh(selectedName);
  }

  const selectedEntry = saved.find((p) => p.name === selectedName);

  return (
    <div className="pattern-manager">
      <form className="pattern-manager__save" onSubmit={handleSave}>
        <input
          type="text"
          className="pattern-manager__name-input"
          placeholder="Pattern name…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
        />
        <button type="submit" className="pattern-manager__save-btn" disabled={!name.trim()}>
          💾 Save
        </button>
      </form>

      <button
        type="button"
        className="pattern-manager__save-btn"
        onClick={onClear}
        title="Reset every step in the current pattern to off"
      >
        ✕ Clear
      </button>

      <button
        type="button"
        className="pattern-manager__save-btn"
        onClick={() => downloadPatternAsMidi(pattern)}
        title="Export the current pattern as a Standard MIDI file to import into a DAW"
      >
        🎹 Export MIDI
      </button>

      {saved.length > 0 && (
        <div className="pattern-manager__load">
          <select
            className="pattern-manager__select"
            value={selectedName}
            onChange={(e) => setSelectedName(e.target.value)}
          >
            {saved.map((p) => (
              <option key={p.name} value={p.name}>
                {p.isReference ? '⭐ ' : ''}
                {p.name}
              </option>
            ))}
          </select>
          <button type="button" className="pattern-manager__load-btn" onClick={handleLoad}>
            📂 Load
          </button>
          <button
            type="button"
            className="pattern-manager__delete-btn"
            onClick={handleDelete}
            title="Delete pattern"
          >
            🗑
          </button>
          <label
            className="guitar-panel__latency-toggle"
            title="Use this pattern as a style reference for AI beat generation"
          >
            <input
              type="checkbox"
              checked={Boolean(selectedEntry?.isReference)}
              onChange={handleReferenceToggle}
            />
            ⭐ Use as AI reference
          </label>
        </div>
      )}
    </div>
  );
}
