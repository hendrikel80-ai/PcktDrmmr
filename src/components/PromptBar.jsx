import { useState } from 'react';

export default function PromptBar({ onGenerate }) {
  const [prompt, setPrompt] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | error
  const [errorMessage, setErrorMessage] = useState('');
  const [lastFromCache, setLastFromCache] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed || status === 'loading') return;

    setStatus('loading');
    setErrorMessage('');

    try {
      const response = await fetch('/api/generate-pattern', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: trimmed }),
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
      setStatus('idle');
    } catch (err) {
      setStatus('error');
      setErrorMessage(err.message);
    }
  }

  return (
    <form className="prompt-bar" onSubmit={handleSubmit}>
      <input
        type="text"
        className="prompt-bar__input"
        placeholder='e.g. "Funk beat 100 BPM" or "in the style of Nirvana"'
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        maxLength={300}
        disabled={status === 'loading'}
      />
      <button type="submit" className="prompt-bar__submit" disabled={status === 'loading' || !prompt.trim()}>
        {status === 'loading' ? 'Generating…' : '✨ Generate'}
      </button>
      {status === 'error' && <div className="prompt-bar__error">{errorMessage}</div>}
      {status === 'idle' && lastFromCache && (
        <span className="prompt-bar__cache-hint" title="Served from the local cache — no AI tokens used">
          📦 from cache
        </span>
      )}
    </form>
  );
}
