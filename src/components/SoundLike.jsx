import { useState } from 'react';
import ampIcon from '../assets/icon-amp.png';

// "Sound Like": enter a musician/band, Claude researches (web search
// tool, see server/soundLike.js) real amp gear and suggests it here in a
// window. Downloading is deliberately NOT automated — every suggestion
// only links to a TONE3000 search that the user clicks through themselves
// in the browser (see docs/sound-like.md: TONE3000's terms of service
// forbid automated downloading/scraping).
const TONE3000_LICENSE_HINT =
  'The link only leads to the TONE3000 search — downloading there is normal, manual browsing. ' +
  'TONE3000 downloads are usually under the "T3K" license (private/commercial use of the audio ' +
  'data allowed, no redistribution of the raw file).';

export default function SoundLike() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | error
  const [errorMessage, setErrorMessage] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [usedWebSearch, setUsedWebSearch] = useState(true);
  const [fromCache, setFromCache] = useState(false);
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
        throw new Error(`Server unreachable (status ${response.status}). Is the backend running?`);
      }

      if (!response.ok) {
        throw new Error(data.error || `Server error (${response.status})`);
      }

      setSuggestions(data.suggestions);
      setUsedWebSearch(Boolean(data.usedWebSearch));
      setFromCache(Boolean(data.fromCache));
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
        <img src={ampIcon} alt="" className="sound-like__icon" />
        <input
          type="text"
          className="sound-like__input"
          placeholder='Make me Sound Like: e.g. "James Hetfield", "Eric Clapton", "Metallica"'
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          maxLength={100}
          disabled={status === 'loading'}
        />
        <button type="submit" className="sound-like__submit" disabled={status === 'loading' || !query.trim()}>
          {status === 'loading' ? 'Researching…' : 'Make me Sound Like'}
        </button>
      </form>

      {status === 'error' && <div className="sound-like__error">{errorMessage}</div>}

      {isOpen && (
        <div className="sound-like-modal__backdrop" onClick={() => setIsOpen(false)}>
          <div className="sound-like-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sound-like-modal__header">
              <h3>
                <img src={ampIcon} alt="" className="sound-like-modal__header-icon" />
                Make me Sound Like: "{searchedFor}"
              </h3>
              <button
                type="button"
                className="sound-like-modal__close"
                onClick={() => setIsOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {fromCache && (
              <p className="sound-like-modal__cache-hint">
                📦 Served from the local cache — no AI tokens used for this search.
              </p>
            )}

            {!usedWebSearch && (
              <p className="sound-like-modal__no-search">
                ⚠ The currently configured AI provider doesn't support live web search — these
                suggestions come from general model knowledge, not current research.
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
                    Search on TONE3000 ↗
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
