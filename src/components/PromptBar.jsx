import { useState } from 'react';
import drumkitIcon from '../assets/icon-drumkit.png';
import { listReferencePatterns } from '../data/patternStorage';

const MAX_REFERENCE_PATTERNS = 5;

export default function PromptBar({ onGenerate }) {
  const [prompt, setPrompt] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | error
  const [errorMessage, setErrorMessage] = useState('');
  const [lastFromCache, setLastFromCache] = useState(false);
  const [lastReferenceCount, setLastReferenceCount] = useState(0);

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed || status === 'loading') return;

    setStatus('loading');
    setErrorMessage('');

    const referencePatterns = listReferencePatterns().slice(0, MAX_REFERENCE_PATTERNS);

    try {
      const response = await fetch('/api/generate-pattern', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: trimmed, referencePatterns }),
      });

      let data;
      try {
        data = await response.json();
      } catch {
        // Empty/invalid body, e.g. because the backend isn't running
        // (Vite's dev proxy then returns an empty 500 instead of a JSON
        // error message).
        throw new Error(
          `Server unreachable (status ${response.status}). Is the backend running? ("npm run dev:full" instead of just "npm run dev")`
        );
      }

      if (!response.ok) {
        throw new Error(data.error || `Server error (${response.status})`);
      }

      onGenerate(data.pattern);
      setLastFromCache(Boolean(data.fromCache));
      setLastReferenceCount(referencePatterns.length);
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
          <img src={drumkitIcon} alt="" className="generation-box__heading-icon" />
          <span>Generate a Beat</span>
        </div>
        <input
          type="text"
          className="generation-box__input"
          placeholder='e.g. "Funk beat 100 BPM" or "in the style of Nirvana"'
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          maxLength={300}
          disabled={status === 'loading'}
        />
        <button type="submit" className="generation-box__button" disabled={status === 'loading' || !prompt.trim()}>
          {status === 'loading' ? 'Generating…' : '✨ Generate'}
        </button>
        {status === 'error' && <div className="prompt-bar__error">{errorMessage}</div>}
        {status === 'idle' && lastFromCache && (
          <span className="prompt-bar__cache-hint" title="Served from the local cache — no AI tokens used">
            📦 from cache
          </span>
        )}
        {status === 'idle' && lastReferenceCount > 0 && (
          <span
            className="prompt-bar__reference-hint"
            title="Patterns marked '⭐ Use as AI reference' in the pattern manager below"
          >
            🎨 Using {lastReferenceCount} of your patterns as style reference
          </span>
        )}
      </form>
    </div>
  );
}
