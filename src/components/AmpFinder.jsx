import { useState } from 'react';

export default function AmpFinder() {
  const [prompt, setPrompt] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | error
  const [errorMessage, setErrorMessage] = useState('');
  const [suggestions, setSuggestions] = useState([]);

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed || status === 'loading') return;

    setStatus('loading');
    setErrorMessage('');

    try {
      const response = await fetch('/api/suggest-amps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: trimmed }),
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
      setStatus('idle');
    } catch (err) {
      setStatus('error');
      setErrorMessage(err.message);
    }
  }

  return (
    <div className="amp-finder">
      <form className="amp-finder__form" onSubmit={handleSubmit}>
        <input
          type="text"
          className="amp-finder__input"
          placeholder='z.B. "Slayer" oder "Metallica" oder "warmer Blues-Sound"'
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          maxLength={300}
          disabled={status === 'loading'}
        />
        <button type="submit" className="amp-finder__submit" disabled={status === 'loading' || !prompt.trim()}>
          {status === 'loading' ? 'Suche…' : '🎯 Amp-Empfehlungen'}
        </button>
      </form>

      {status === 'error' && <div className="amp-finder__error">{errorMessage}</div>}

      {suggestions.length > 0 && (
        <ul className="amp-finder__results">
          {suggestions.map((s, i) => (
            <li key={i} className="amp-finder__result">
              <div className="amp-finder__result-header">
                <strong>{s.amp}</strong>
                <a
                  href={`https://www.tone3000.com/search?format=nam&gears=amp&q=${encodeURIComponent(s.searchQuery)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="amp-finder__link"
                >
                  Auf TONE3000 suchen ↗
                </a>
              </div>
              <p className="amp-finder__reason">{s.reason}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
