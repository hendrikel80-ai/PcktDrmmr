import { useEffect, useState } from 'react';
import { listPatterns } from '../data/patternStorage';
import {
  deleteArrangement,
  listArrangements,
  loadArrangement,
  saveArrangement,
} from '../data/arrangementStorage';

const MAX_REPEATS = 32;

// Song/Arrangement Mode: a saved, named playlist of already-saved patterns
// (each with its own repeat count), played back in order by App.jsx/
// MobileApp.jsx — see their currentStep-watching effect for how a "loop
// just completed" is detected and turned into "advance to the next entry".
// This component only edits the entry list + does its own save/load/
// delete of named arrangements (mirrors PatternManager.jsx exactly); it
// never touches playback itself.
export default function ArrangementEditor({
  entries,
  onEntriesChange,
  loopArrangement,
  onLoopArrangementChange,
  onPlaySong,
  onStopSong,
  isArrangementPlaying,
  activeIndex,
  activeLoopsDone,
  error,
}) {
  const [songName, setSongName] = useState('');
  const [saved, setSaved] = useState([]);
  const [selectedSongName, setSelectedSongName] = useState('');
  const [patternToAdd, setPatternToAdd] = useState('');

  // Read fresh on every render instead of caching in state — patterns are
  // saved/deleted over in PatternManager.jsx, a sibling component with no
  // shared store or change event, so a cached copy here would silently go
  // stale the moment the user saves a new pattern without ever touching
  // this component. listPatterns() is a cheap synchronous localStorage
  // read at this app's scale (a handful of patterns), so there's no real
  // cost to just always reading the current truth.
  const patternNames = listPatterns().map((p) => p.name);
  const effectivePatternToAdd = patternNames.includes(patternToAdd)
    ? patternToAdd
    : (patternNames[0] ?? '');

  useEffect(() => {
    refreshSaved();
  }, []);

  function refreshSaved(preferredName) {
    const list = listArrangements();
    setSaved(list);
    if (list.length === 0) {
      setSelectedSongName('');
    } else if (preferredName && list.some((a) => a.name === preferredName)) {
      setSelectedSongName(preferredName);
    } else if (!list.some((a) => a.name === selectedSongName)) {
      setSelectedSongName(list[0].name);
    }
  }

  function handleAddEntry() {
    if (!effectivePatternToAdd) return;
    onEntriesChange([...entries, { patternName: effectivePatternToAdd, repeats: 1 }]);
  }

  function handleRemoveEntry(index) {
    onEntriesChange(entries.filter((_, i) => i !== index));
  }

  function handleRepeatsChange(index, repeats) {
    const clamped = Math.max(1, Math.min(MAX_REPEATS, Math.round(repeats) || 1));
    onEntriesChange(entries.map((e, i) => (i === index ? { ...e, repeats: clamped } : e)));
  }

  function handleMove(index, delta) {
    const target = index + delta;
    if (target < 0 || target >= entries.length) return;
    const next = entries.slice();
    [next[index], next[target]] = [next[target], next[index]];
    onEntriesChange(next);
  }

  function handleSaveSong(e) {
    e.preventDefault();
    const trimmed = songName.trim();
    if (!trimmed || entries.length === 0) return;
    saveArrangement(trimmed, entries, loopArrangement);
    setSongName('');
    refreshSaved(trimmed);
  }

  function handleLoadSong() {
    const loaded = loadArrangement(selectedSongName);
    if (!loaded) return;
    onEntriesChange(loaded.entries);
    onLoopArrangementChange(loaded.loopArrangement);
  }

  function handleDeleteSong() {
    if (!selectedSongName) return;
    deleteArrangement(selectedSongName);
    refreshSaved();
  }

  return (
    <div className="pattern-manager arrangement-editor">
      <h3 className="arrangement-editor__heading">Song</h3>

      {patternNames.length === 0 ? (
        <p className="instrument-card__hint">
          Save a pattern in the Pattern Manager above first — a song is built from already-saved
          patterns.
        </p>
      ) : (
        <div className="guitar-panel__row">
          <select
            className="pattern-manager__select"
            value={effectivePatternToAdd}
            onChange={(e) => setPatternToAdd(e.target.value)}
          >
            {patternNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <button type="button" className="pattern-manager__load-btn" onClick={handleAddEntry}>
            + Add to Song
          </button>
        </div>
      )}

      {entries.length > 0 && (
        <ol className="arrangement-editor__entries">
          {entries.map((entry, index) => {
            const isActive = isArrangementPlaying && index === activeIndex;
            return (
              <li
                key={`${entry.patternName}-${index}`}
                className={`arrangement-editor__entry${isActive ? ' arrangement-editor__entry--active' : ''}`}
              >
                <span className="arrangement-editor__entry-name">{entry.patternName}</span>
                <span className="transport__bpm arrangement-editor__repeats">
                  <button
                    type="button"
                    className="transport__bpm-step"
                    onClick={() => handleRepeatsChange(index, entry.repeats - 1)}
                    disabled={entry.repeats <= 1}
                    aria-label={`Fewer repeats for ${entry.patternName}`}
                  >
                    −
                  </button>
                  <span className="transport__bpm-unit">
                    ×{entry.repeats}
                    {isActive ? ` (${Math.min(activeLoopsDone + 1, entry.repeats)}/${entry.repeats})` : ''}
                  </span>
                  <button
                    type="button"
                    className="transport__bpm-step"
                    onClick={() => handleRepeatsChange(index, entry.repeats + 1)}
                    disabled={entry.repeats >= MAX_REPEATS}
                    aria-label={`More repeats for ${entry.patternName}`}
                  >
                    +
                  </button>
                </span>
                <button
                  type="button"
                  className="pattern-manager__save-btn"
                  onClick={() => handleMove(index, -1)}
                  disabled={index === 0}
                  aria-label={`Move ${entry.patternName} up`}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="pattern-manager__save-btn"
                  onClick={() => handleMove(index, 1)}
                  disabled={index === entries.length - 1}
                  aria-label={`Move ${entry.patternName} down`}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="pattern-manager__delete-btn"
                  onClick={() => handleRemoveEntry(index)}
                  title="Remove from song"
                >
                  🗑
                </button>
              </li>
            );
          })}
        </ol>
      )}

      <div className="guitar-panel__row">
        <label className="guitar-panel__latency-toggle">
          <input
            type="checkbox"
            checked={loopArrangement}
            onChange={(e) => onLoopArrangementChange(e.target.checked)}
          />
          Loop whole song
        </label>
        <button
          type="button"
          className={['transport__play', isArrangementPlaying ? 'transport__play--active' : ''].join(' ')}
          onClick={isArrangementPlaying ? onStopSong : onPlaySong}
          disabled={!isArrangementPlaying && entries.length === 0}
        >
          {isArrangementPlaying ? '⏸ Stop Song' : '▶ Play Song'}
        </button>
      </div>

      {error && <div className="prompt-bar__error">{error}</div>}

      <form className="pattern-manager__save" onSubmit={handleSaveSong}>
        <input
          type="text"
          className="pattern-manager__name-input"
          placeholder="Song name…"
          value={songName}
          onChange={(e) => setSongName(e.target.value)}
          maxLength={60}
        />
        <button type="submit" className="pattern-manager__save-btn" disabled={!songName.trim() || entries.length === 0}>
          Save Song
        </button>
      </form>

      {saved.length > 0 && (
        <div className="pattern-manager__load">
          <select
            className="pattern-manager__select"
            value={selectedSongName}
            onChange={(e) => setSelectedSongName(e.target.value)}
          >
            {saved.map((a) => (
              <option key={a.name} value={a.name}>
                {a.name}
              </option>
            ))}
          </select>
          <button type="button" className="pattern-manager__load-btn" onClick={handleLoadSong}>
            Load
          </button>
          <button
            type="button"
            className="pattern-manager__delete-btn"
            onClick={handleDeleteSong}
            title="Delete song"
          >
            🗑
          </button>
        </div>
      )}
    </div>
  );
}
