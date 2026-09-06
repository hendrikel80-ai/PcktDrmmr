import { SOUND_LIKE_SYSTEM_PROMPT } from './soundLikePrompt.js';
import { UpstreamError } from './generatePattern.js';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
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

export async function soundLike(query) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new UpstreamError('ANTHROPIC_API_KEY ist nicht gesetzt (siehe .env.example)', 500);
  }

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SOUND_LIKE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: query }],
      // Serverseitiges Web-Search-Tool: Claude recherchiert das tatsächliche
      // Equipment selbst, statt sich nur auf eingefrorenes Trainingswissen zu
      // verlassen (siehe soundLikePrompt.js für die Tone3000-Ausnahme).
      // max_uses begrenzt Kosten/Latenz pro Anfrage.
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
    }),
  });

  if (!response.ok) {
    const bodyText = await response.text().catch(() => '');
    throw new UpstreamError(`Claude API antwortete mit ${response.status}: ${bodyText.slice(0, 300)}`, 502);
  }

  const data = await response.json();
  // Mit aktiviertem Web-Search-Tool enthält `content` zusätzlich zu Text auch
  // server_tool_use-/web_search_tool_result-Blöcke — nur die Text-Blöcke
  // zusammen ergeben unsere JSON-Antwort.
  const rawText = (data.content || [])
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
  if (!rawText) {
    throw new UpstreamError('Claude API lieferte keinen Text-Content', 502);
  }

  let parsed;
  try {
    parsed = JSON.parse(extractJson(rawText));
    validateSuggestions(parsed);
  } catch (err) {
    throw new UpstreamError(`Ungültige Antwort von Claude: ${err.message}`, 502);
  }

  return parsed.suggestions;
}
