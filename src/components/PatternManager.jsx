import { useEffect, useState } from 'react';
import { deletePattern, listPatterns, loadPattern, savePattern, setPatternReference } from '../data/patternStorage';
import { downloadPatternAsMidi } from '../audio/midiExport';

export default function PatternManager({ pattern, onLoad, onClear, canUndo, onUndo }) {
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
          <svg
            viewBox="0 0 24 24"
            width="13"
            height="13"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ verticalAlign: '-2px', marginRight: '4px' }}
            aria-hidden="true"
          >
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
          </svg>
          Save
        </button>
      </form>

      {onUndo && (
        <button
          type="button"
          className="pattern-manager__save-btn"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo the last pattern edit (Ctrl+Z)"
        >
          <svg
            viewBox="0 0 24 24"
            width="13"
            height="13"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ verticalAlign: '-2px', marginRight: '4px' }}
            aria-hidden="true"
          >
            <polyline points="9 14 4 9 9 4" />
            <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
          </svg>
          Undo
        </button>
      )}

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
        <svg
          viewBox="0 0 24 24"
          width="13"
          height="13"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ verticalAlign: '-2px', marginRight: '4px' }}
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="7.3" r="0.9" fill="currentColor" stroke="none" />
          <circle cx="8.7" cy="9.3" r="0.9" fill="currentColor" stroke="none" />
          <circle cx="15.3" cy="9.3" r="0.9" fill="currentColor" stroke="none" />
          <circle cx="8.7" cy="13.3" r="0.9" fill="currentColor" stroke="none" />
          <circle cx="15.3" cy="13.3" r="0.9" fill="currentColor" stroke="none" />
        </svg>
        Export MIDI
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
            <svg
              viewBox="0 0 24 24"
              width="13"
              height="13"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ verticalAlign: '-2px', marginRight: '4px' }}
              aria-hidden="true"
            >
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            Load
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
            <svg
              viewBox="0 0 24 24"
              width="13"
              height="13"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ verticalAlign: '-2px', marginRight: '4px' }}
              aria-hidden="true"
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            Use as AI reference
          </label>
        </div>
      )}
    </div>
  );
}
