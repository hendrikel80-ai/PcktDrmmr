import { useEffect, useState } from 'react';
import { listPatterns, savePattern } from '../data/patternStorage';
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

  // Second "lane" for building a song directly from the curated Beat
  // Library (see LibraryBrowser.jsx, same genre -> subgenre -> pattern
  // cascade and /api/library fetch), alongside the "own saved patterns"
  // lane above. A library pattern has no name of its own to reference by
  // (unlike a saved pattern), so adding one first silently saves a copy
  // into patternStorage under a generated, descriptive name — reusing the
  // exact same {patternName, repeats} entry shape and playback lookup the
  // rest of this component/App.jsx already rely on, instead of teaching
  // the arrangement data model and playback code a second entry "kind".
  const [libraryEntries, setLibraryEntries] = useState([]);
  const [libraryStatus, setLibraryStatus] = useState('loading'); // loading | error | ready
  const [libraryErrorMessage, setLibraryErrorMessage] = useState('');
  const [libraryGenreSlug, setLibraryGenreSlug] = useState('');
  const [librarySubgenreSlug, setLibrarySubgenreSlug] = useState('');
  const [librarySelectedIndex, setLibrarySelectedIndex] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/library')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setLibraryEntries(Array.isArray(data.entries) ? data.entries : []);
        setLibraryStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setLibraryErrorMessage(err.message);
        setLibraryStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  function handleLibraryGenreChange(slug) {
    setLibraryGenreSlug(slug);
    setLibrarySubgenreSlug('');
    setLibrarySelectedIndex('');
  }

  function handleLibrarySubgenreChange(slug) {
    setLibrarySubgenreSlug(slug);
    setLibrarySelectedIndex('');
  }

  function handleAddLibraryEntry() {
    const entry = libraryEntries[Number(librarySelectedIndex)];
    if (!entry) return;
    // Unique-enough name: same genre/subgenre/BPM picked twice would
    // otherwise silently overwrite the first saved copy (savePattern
    // replaces by name) — a short random suffix rules that out without
    // needing to check existing names first.
    const suffix = Math.random().toString(36).slice(2, 6);
    const name = `${entry.genreLabel} – ${entry.subgenreLabel} (${entry.pattern.bpm} BPM) #${suffix}`;
    savePattern(name, entry.pattern);
    onEntriesChange([...entries, { patternName: name, repeats: 1 }]);
    setLibrarySelectedIndex('');
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

  const libraryReady = libraryStatus === 'ready' && libraryEntries.length > 0;
  const libraryGenres = libraryReady
    ? [...new Map(libraryEntries.map((e) => [e.genreSlug, e.genreLabel])).entries()]
    : [];
  const librarySubgenres = libraryReady
    ? [
        ...new Map(
          libraryEntries
            .filter((e) => e.genreSlug === libraryGenreSlug)
            .map((e) => [e.subgenreSlug, e.subgenreLabel])
        ).entries(),
      ]
    : [];
  const libraryPatterns = libraryReady
    ? libraryEntries
        .map((e, index) => ({ ...e, index }))
        .filter((e) => e.genreSlug === libraryGenreSlug && e.subgenreSlug === librarySubgenreSlug)
    : [];

  return (
    <div className="pattern-manager arrangement-editor">
      <h3 className="arrangement-editor__heading">Build a Song</h3>

      <div className="arrangement-editor__lane">
        <span className="arrangement-editor__lane-label">From Library</span>
        {libraryStatus === 'error' ? (
          <div className="prompt-bar__error">Beat library unavailable: {libraryErrorMessage}</div>
        ) : libraryReady ? (
          <div className="guitar-panel__row">
            <select
              className="pattern-manager__select"
              value={libraryGenreSlug}
              onChange={(e) => handleLibraryGenreChange(e.target.value)}
            >
              <option value="">Genre…</option>
              {libraryGenres.map(([slug, label]) => (
                <option key={slug} value={slug}>
                  {label}
                </option>
              ))}
            </select>
            <select
              className="pattern-manager__select"
              value={librarySubgenreSlug}
              onChange={(e) => handleLibrarySubgenreChange(e.target.value)}
              disabled={!libraryGenreSlug}
            >
              <option value="">Subgenre…</option>
              {librarySubgenres.map(([slug, label]) => (
                <option key={slug} value={slug}>
                  {label}
                </option>
              ))}
            </select>
            <select
              className="pattern-manager__select"
              value={librarySelectedIndex}
              onChange={(e) => setLibrarySelectedIndex(e.target.value)}
              disabled={!librarySubgenreSlug}
            >
              <option value="">Pattern…</option>
              {libraryPatterns.map((p) => (
                <option key={p.index} value={p.index}>
                  {p.pattern.bpm} BPM — {(p.pattern.style_description || 'pattern').slice(0, 60)}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="pattern-manager__load-btn"
              onClick={handleAddLibraryEntry}
              disabled={librarySelectedIndex === ''}
            >
              + Add to Song
            </button>
          </div>
        ) : (
          libraryStatus === 'ready' && (
            <p className="instrument-card__hint">No beats in the library yet.</p>
          )
        )}
      </div>

      <div className="arrangement-editor__lane">
        <span className="arrangement-editor__lane-label">From Own Patterns</span>
        {patternNames.length === 0 ? (
          <p className="instrument-card__hint">
            Save a pattern in Build a Beat above first — a song is built from already-saved
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
      </div>

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
