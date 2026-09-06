import { useState } from 'react';

// "Sound Like": Musiker/Band eingeben, Claude recherchiert (Web-Search-Tool,
// siehe server/soundLike.js) reales Amp-Equipment und schlägt es hier in
// einem Fenster vor. Der Download passiert bewusst NICHT automatisiert —
// jeder Vorschlag verlinkt nur auf eine TONE3000-Suche, die der Nutzer
// selbst im Browser anklickt (siehe docs/amp-library.md: TONE3000s
// Nutzungsbedingungen verbieten automatisiertes Herunterladen/Scrapen).
const TONE3000_LICENSE_HINT =
  'Der Link führt nur zur TONE3000-Suche — heruntergeladen wird dort ganz normal von Hand. ' +
  'TONE3000-Downloads unterliegen meist der "T3K"-Lizenz (private/kommerzielle Nutzung erlaubt, ' +
  'keine Weiterverbreitung der Rohdatei).';

export default function SoundLike() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | error
  const [errorMessage, setErrorMessage] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [usedWebSearch, setUsedWebSearch] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [searchedFor, setSearchedFor] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed || status === 'loading') return;

    setStatus('loading');
    setErrorMessage('');

    try {
      const response = await fetch('/api/sound-like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: trimmed }),
      });

      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error(`Server nicht erreichbar (Status ${response.status}). Läuft das Backend?`);
      }

      if (!response.ok) {
        throw new Error(data.error || `Server-Fehler (${response.status})`);
      }

      setSuggestions(data.suggestions);
      setUsedWebSearch(Boolean(data.usedWebSearch));
      setSearchedFor(trimmed);
      setIsOpen(true);
      setStatus('idle');
    } catch (err) {
      setStatus('error');
      setErrorMessage(err.message);
    }
  }

  return (
    <div className="sound-like">
      <form className="sound-like__form" onSubmit={handleSubmit}>
        <input
          type="text"
          className="sound-like__input"
          placeholder='🔎 Sound Like: z.B. "James Hetfield", "Eric Clapton", "Metallica"'
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          maxLength={100}
          disabled={status === 'loading'}
        />
        <button type="submit" className="sound-like__submit" disabled={status === 'loading' || !query.trim()}>
          {status === 'loading' ? 'Recherchiere…' : 'Sound Like'}
        </button>
      </form>

      {status === 'error' && <div className="sound-like__error">{errorMessage}</div>}

      {isOpen && (
        <div className="sound-like-modal__backdrop" onClick={() => setIsOpen(false)}>
          <div className="sound-like-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sound-like-modal__header">
              <h3>🔎 Sound Like: "{searchedFor}"</h3>
              <button
                type="button"
                className="sound-like-modal__close"
                onClick={() => setIsOpen(false)}
                aria-label="Schließen"
              >
                ✕
              </button>
            </div>

            {!usedWebSearch && (
              <p className="sound-like-modal__no-search">
                ⚠ Der aktuell eingestellte KI-Provider unterstützt keine Live-Websuche — diese
                Vorschläge stammen aus allgemeinem Modellwissen, nicht aus aktueller Recherche.
              </p>
            )}

            <ul className="sound-like-modal__results">
              {suggestions.map((s, i) => (
                <li key={i} className="sound-like-modal__result">
                  <div className="sound-like-modal__result-header">
                    <strong>{s.amp}</strong>
                    {s.player && <span className="sound-like-modal__player">{s.player}</span>}
                  </div>
                  <p className="sound-like-modal__reason">{s.reason}</p>
                  <a
                    href={`https://www.tone3000.com/search?format=nam&gears=amp&q=${encodeURIComponent(s.searchQuery)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="sound-like-modal__link"
                  >
                    Auf TONE3000 suchen ↗
                  </a>
                </li>
              ))}
            </ul>

            <p className="sound-like-modal__hint">{TONE3000_LICENSE_HINT}</p>
          </div>
        </div>
      )}
    </div>
  );
}
