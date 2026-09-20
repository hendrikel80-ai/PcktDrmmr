import { useEffect, useState } from 'react';

// Aktives Durchsuchen/Laden aus der Beat-Library (Genre -> Subgenre ->
// Pattern), als Alternative zur heuristischen Suche in PromptBar.jsx — auf
// Nutzerwunsch, nicht nur implizit über die Prompt-Suchleiste ladbar.
// Lädt einmalig die komplette Library (klein genug für einen Request, siehe
// server/library.js's listLibrary()) und filtert rein client-seitig.
export default function LibraryBrowser({ onLoad }) {
  const [entries, setEntries] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | error | ready
  const [errorMessage, setErrorMessage] = useState('');
  const [genreSlug, setGenreSlug] = useState('');
  const [subgenreSlug, setSubgenreSlug] = useState('');
  const [selectedIndex, setSelectedIndex] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/library')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setEntries(Array.isArray(data.entries) ? data.entries : []);
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMessage(err.message);
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleGenreChange(slug) {
    setGenreSlug(slug);
    setSubgenreSlug('');
    setSelectedIndex('');
  }

  function handleSubgenreChange(slug) {
    setSubgenreSlug(slug);
    setSelectedIndex('');
  }

  function handleLoad() {
    const entry = entries[Number(selectedIndex)];
    if (entry) onLoad(entry.pattern);
  }

  // Loading, or nothing generated yet (fresh checkout before
  // `npm run generate-library` has ever run) — stay out of the way rather
  // than showing empty dropdowns. Error must be checked BEFORE the
  // empty-entries case, or a failed fetch (e.g. backend not running) would
  // silently render nothing instead of telling the user why.
  if (status === 'loading') return null;
  if (status === 'error') {
    return <div className="prompt-bar__error">Beat library unavailable: {errorMessage}</div>;
  }
  if (entries.length === 0) return null;

  const genres = [...new Map(entries.map((e) => [e.genreSlug, e.genreLabel])).entries()];
  const subgenres = [
    ...new Map(
      entries.filter((e) => e.genreSlug === genreSlug).map((e) => [e.subgenreSlug, e.subgenreLabel])
    ).entries(),
  ];
  const patterns = entries
    .map((e, index) => ({ ...e, index }))
    .filter((e) => e.genreSlug === genreSlug && e.subgenreSlug === subgenreSlug);

  return (
    <div className="pattern-manager library-browser">
      <select
        className="pattern-manager__select"
        value={genreSlug}
        onChange={(e) => handleGenreChange(e.target.value)}
      >
        <option value="">Genre…</option>
        {genres.map(([slug, label]) => (
          <option key={slug} value={slug}>
            {label}
          </option>
        ))}
      </select>
      <select
        className="pattern-manager__select"
        value={subgenreSlug}
        onChange={(e) => handleSubgenreChange(e.target.value)}
        disabled={!genreSlug}
      >
        <option value="">Subgenre…</option>
        {subgenres.map(([slug, label]) => (
          <option key={slug} value={slug}>
            {label}
          </option>
        ))}
      </select>
      <select
        className="pattern-manager__select"
        value={selectedIndex}
        onChange={(e) => setSelectedIndex(e.target.value)}
        disabled={!subgenreSlug}
      >
        <option value="">Pattern…</option>
        {patterns.map((p) => (
          <option key={p.index} value={p.index}>
            {p.pattern.bpm} BPM — {(p.pattern.style_description || 'pattern').slice(0, 60)}
          </option>
        ))}
      </select>
      <button type="button" className="pattern-manager__load-btn" onClick={handleLoad} disabled={selectedIndex === ''}>
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
        Load from Library
      </button>
    </div>
  );
}
