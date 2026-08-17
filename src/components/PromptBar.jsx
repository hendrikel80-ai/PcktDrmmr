import { useState } from 'react';

export default function PromptBar({ onGenerate }) {
  const [prompt, setPrompt] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | error
  const [errorMessage, setErrorMessage] = useState('');

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
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Server-Fehler (${response.status})`);
      }

      onGenerate(data.pattern);
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
        placeholder='z.B. "Funk Beat 100 BPM" oder "im Stile von Nirvana"'
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        maxLength={300}
        disabled={status === 'loading'}
      />
      <button type="submit" className="prompt-bar__submit" disabled={status === 'loading' || !prompt.trim()}>
        {status === 'loading' ? 'Generiere…' : '✨ Generieren'}
      </button>
      {status === 'error' && <div className="prompt-bar__error">{errorMessage}</div>}
    </form>
  );
}
