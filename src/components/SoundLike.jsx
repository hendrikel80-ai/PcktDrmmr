import { useState } from 'react';
import ampIcon from '../assets/icon-amp.png';
import { isTauriRuntime } from '../utils/platform';

// A plain <a target="_blank"> does nothing in the Tauri desktop shell on
// its own — there's no browser tab to open a new one in. The opener plugin
// (src-tauri/src/lib.rs's tauri_plugin_opener::init() + capabilities/
// default.json's "opener:default") normally intercepts such clicks
// automatically via its own window-level listener, no JS glue needed — but
// this modal's own backdrop-close handling calls stopPropagation() on
// every click inside it (see the modal div below), which stops the click
// from ever bubbling up to that window-level listener. So this link needs
// its own handler after all — using window.__TAURI__.core.invoke directly
// (the same low-level bridge every other Tauri call in this app already
// goes through) rather than window.__TAURI__.opener.openUrl, which depends
// on a separate, less reliably-bundled JS API surface. Reports failures
// via `onError` (instead of only console.error) so a rejected/denied call
// is visible in the UI without needing devtools open.
function openExternal(e, url, onError) {
  if (!isTauriRuntime()) return; // plain browser tab: let the normal <a target="_blank"> handle it
  e.preventDefault();
  window.__TAURI__.core.invoke('plugin:opener|open_url', { url }).catch((err) => {
    console.error(err);
    onError?.(err?.message || String(err));
  });
}

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
  const [linkError, setLinkError] = useState('');

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
    <div className="generation-box">
      <form className="generation-box__form" onSubmit={handleSubmit}>
        <div className="generation-box__heading">
          <img src={ampIcon} alt="" className="generation-box__heading-icon" />
          <span>Make me Sound Like</span>
        </div>
        <input
          type="text"
          className="generation-box__input"
          placeholder='e.g. "James Hetfield", "Eric Clapton", "Metallica"'
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          maxLength={100}
          disabled={status === 'loading'}
        />
        <button type="submit" className="generation-box__button" disabled={status === 'loading' || !query.trim()}>
          {status === 'loading' ? 'Researching…' : '✨ Make me Sound Like'}
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
              {suggestions.map((s, i) => {
                const tone3000Url = `https://www.tone3000.com/search?format=nam&gears=amp&q=${encodeURIComponent(s.searchQuery)}`;
                return (
                  <li key={i} className="sound-like-modal__result">
                    <div className="sound-like-modal__result-header">
                      <strong>{s.amp}</strong>
                      {s.player && <span className="sound-like-modal__player">{s.player}</span>}
                    </div>
                    <p className="sound-like-modal__reason">{s.reason}</p>
                    <a
                      href={tone3000Url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="sound-like-modal__link"
                      onClick={(e) => openExternal(e, tone3000Url, setLinkError)}
                    >
                      Search on TONE3000 ↗
                    </a>
                  </li>
                );
              })}
            </ul>
            {linkError && <p className="sound-like-modal__link-error">Couldn't open the browser: {linkError}</p>}

            <p className="sound-like-modal__hint">{TONE3000_LICENSE_HINT}</p>
          </div>
        </div>
      )}
    </div>
  );
}
