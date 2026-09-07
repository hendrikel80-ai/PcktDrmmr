import { SOUND_LIKE_SYSTEM_PROMPT } from './soundLikePrompt.js';
import { callChatModel, UpstreamError } from './aiProvider.js';
import { getCached, setCached } from './cache.js';

const MAX_TOKENS = 1200; // Websuche braucht mehr Spielraum als reines Modellwissen
const CACHE_FILE = 'soundLikeCache.json';

function extractJson(rawText) {
  const trimmed = rawText.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1] : trimmed;
}

function validateSuggestions(parsed) {
  if (!parsed || !Array.isArray(parsed.suggestions)) {
    throw new Error('Response contains no "suggestions" array');
  }
  if (parsed.suggestions.length === 0) {
    throw new Error('"suggestions" array is empty');
  }
  for (const s of parsed.suggestions) {
    if (typeof s.amp !== 'string' || typeof s.reason !== 'string' || typeof s.searchQuery !== 'string') {
      throw new Error('A suggestion has missing/invalid fields (amp/reason/searchQuery)');
    }
  }
}

// Liefert `{ suggestions, usedWebSearch }` — `usedWebSearch` ist false,
// wenn der konfigurierte Provider (AI_PROVIDER) kein serverseitiges
// Web-Search-Tool unterstützt (siehe aiProvider.js). Der Aufrufer (die UI)
// sollte das anzeigen, statt eine Recherche vorzutäuschen, die nicht
// stattgefunden hat.
export async function soundLike(query) {
  const cached = getCached(CACHE_FILE, query);
  if (cached) {
    return { ...cached, fromCache: true };
  }

  const { text: rawText, usedWebSearch } = await callChatModel({
    system: SOUND_LIKE_SYSTEM_PROMPT,
    userMessage: query,
    maxTokens: MAX_TOKENS,
    webSearch: true,
  });

  let parsed;
  try {
    parsed = JSON.parse(extractJson(rawText));
    validateSuggestions(parsed);
  } catch (err) {
    throw new UpstreamError(`Invalid response from the model: ${err.message}`, 502);
  }

  const result = { suggestions: parsed.suggestions, usedWebSearch };
  setCached(CACHE_FILE, query, result);
  return { ...result, fromCache: false };
}
