import { SUGGEST_AMPS_SYSTEM_PROMPT } from './suggestAmpsPrompt.js';
import { UpstreamError } from './generatePattern.js';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
const MAX_TOKENS = 600;

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

export async function suggestAmps(userPrompt) {
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
      system: SUGGEST_AMPS_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const bodyText = await response.text().catch(() => '');
    throw new UpstreamError(`Claude API antwortete mit ${response.status}: ${bodyText.slice(0, 300)}`, 502);
  }

  const data = await response.json();
  const rawText = data.content?.[0]?.text;
  if (typeof rawText !== 'string') {
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
