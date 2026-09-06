import { SOUND_LIKE_SYSTEM_PROMPT } from './soundLikePrompt.js';
import { callChatModel, UpstreamError } from './aiProvider.js';

const MAX_TOKENS = 1200; // Websuche braucht mehr Spielraum als reines Modellwissen

function extractJson(rawText) {
  const trimmed = rawText.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1] : trimmed;
}

function validateSuggestions(parsed) {
  if (!parsed || !Array.isArray(parsed.suggestions)) {
    throw new Error('Antwort enthält kein "suggestions"-Array');
  }
  if (parsed.suggestions.length === 0) {
    throw new Error('"suggestions"-Array ist leer');
  }
  for (const s of parsed.suggestions) {
    if (typeof s.amp !== 'string' || typeof s.reason !== 'string' || typeof s.searchQuery !== 'string') {
      throw new Error('Ein Vorschlag hat fehlende/ungültige Felder (amp/reason/searchQuery)');
    }
  }
}

// Liefert `{ suggestions, usedWebSearch }` — `usedWebSearch` ist false,
// wenn der konfigurierte Provider (AI_PROVIDER) kein serverseitiges
// Web-Search-Tool unterstützt (siehe aiProvider.js). Der Aufrufer (die UI)
// sollte das anzeigen, statt eine Recherche vorzutäuschen, die nicht
// stattgefunden hat.
export async function soundLike(query) {
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
    throw new UpstreamError(`Ungültige Antwort vom Modell: ${err.message}`, 502);
  }

  return { suggestions: parsed.suggestions, usedWebSearch };
}
