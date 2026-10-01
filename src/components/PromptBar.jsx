import { useState } from 'react';
import { listReferencePatterns } from '../data/patternStorage';
import { validatePattern } from '../data/validatePattern';
import { loadBeatLibrary } from '../data/beatLibrary';
import { findLibraryMatch } from '../data/libraryMatch';
import { apiHeaders, apiUrl, backendUnreachableMessage, isAiBackendAvailable } from '../utils/apiAuth';

const MAX_REFERENCE_PATTERNS = 5;

export default function PromptBar({ onGenerate }) {
  const [prompt, setPrompt] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | error
  const [errorMessage, setErrorMessage] = useState('');
  const [lastFromCache, setLastFromCache] = useState(false);
  const [lastFromLibrary, setLastFromLibrary] = useState(false);
  const [lastReferenceCount, setLastReferenceCount] = useState(0);

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed || status === 'loading') return;

    setStatus('loading');
    setErrorMessage('');

    const referencePatterns = listReferencePatterns().slice(0, MAX_REFERENCE_PATTERNS);

    try {
      // Beat-Library zuerst, lokal im Frontend (kuratierte Patterns, kein
      // API-Call, kein Server nötig — siehe src/data/libraryMatch.js). Nur
      // bei einem erkannten Genre-Stichwort; sonst weiter zur KI.
      const libraryMatch = findLibraryMatch(await loadBeatLibrary(), trimmed);
      if (libraryMatch) {
        try {
          validatePattern(libraryMatch.pattern); // defensiv gegen manuell beschädigte Library-Dateien
          // Kopie statt der Referenz aus dem geteilten Library-Index
          onGenerate(structuredClone(libraryMatch.pattern));
          setLastFromCache(false);
          setLastFromLibrary(true);
          setLastReferenceCount(0);
          setStatus('idle');
          return;
        } catch (err) {
          console.error('Library-Pattern ungültig, falle auf Live-Generierung zurück:', err.message);
        }
      }

      if (!isAiBackendAvailable()) {
        throw new Error(
          'No library beat matches this prompt, and AI generation is not available in this version. ' +
            'Try a genre (e.g. "punk 160 bpm", "funk", "reggae") or browse the beat library.'
        );
      }

      let response;
      try {
        response = await fetch(apiUrl('/api/generate-pattern'), {
          method: 'POST',
          headers: apiHeaders(),
          body: JSON.stringify({ prompt: trimmed, referencePatterns }),
        });
      } catch {
        // Netzwerkfehler (kein Server unter der Adresse)
        throw new Error(backendUnreachableMessage('no response'));
      }

      let data;
      try {
        data = await response.json();
      } catch {
        // Empty/invalid body, e.g. because the backend isn't running
        // (Vite's dev proxy then returns an empty 500 instead of a JSON
        // error message).
        throw new Error(backendUnreachableMessage(response.status));
      }

      if (!response.ok) {
        throw new Error(data.error || `Server error (${response.status})`);
      }

      onGenerate(data.pattern);
      setLastFromCache(Boolean(data.fromCache));
      setLastFromLibrary(Boolean(data.fromLibrary));
      // Referenzen fließen nur in die Live-Generierung ein, nicht in einen
      // Library-Treffer — der Hinweis wäre sonst irreführend.
      setLastReferenceCount(data.fromLibrary ? 0 : referencePatterns.length);
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
          <span>Generate a Beat</span>
        </div>
        <input
          type="text"
          className="generation-box__input"
          placeholder={
            isAiBackendAvailable()
              ? 'e.g. "Funk beat 100 BPM" or "in the style of Nirvana"'
              : 'e.g. "Funk beat 100 BPM" or "punk 160 bpm"'
          }
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          maxLength={300}
          disabled={status === 'loading'}
        />
        <button type="submit" className="generation-box__button" disabled={status === 'loading' || !prompt.trim()}>
          {status === 'loading' ? 'Generating…' : '✨ Generate'}
        </button>
        {status === 'error' && <div className="prompt-bar__error">{errorMessage}</div>}
        {status === 'idle' && lastFromLibrary && (
          <span className="prompt-bar__library-hint" title="Served from the curated beat library — no AI tokens used">
            📚 from the beat library
          </span>
        )}
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
