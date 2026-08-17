import { validatePattern } from '../src/data/validatePattern.js';
import { SYSTEM_PROMPT } from './systemPrompt.js';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
const MAX_TOKENS = 1500;
const MAX_ATTEMPTS = 2; // 1 Versuch + 1 Retry bei ungültigem JSON

class UpstreamError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function callClaude(apiKey, userMessage) {
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
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!response.ok) {
    const bodyText = await response.text().catch(() => '');
    throw new UpstreamError(
      `Claude API antwortete mit ${response.status}: ${bodyText.slice(0, 300)}`,
      502
    );
  }

  const data = await response.json();
  const rawText = data.content?.[0]?.text;
  if (typeof rawText !== 'string') {
    throw new UpstreamError('Claude API lieferte keinen Text-Content', 502);
  }
  return rawText;
}

// Entfernt versehentliche Markdown-Codefences, falls das Modell sie trotz
// Anweisung mal ausgibt.
function extractJson(rawText) {
  const trimmed = rawText.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1] : trimmed;
}

export async function generatePattern(userPrompt) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new UpstreamError(
      'ANTHROPIC_API_KEY ist nicht gesetzt (siehe .env.example)',
      500
    );
  }

  let lastError;
  let message = userPrompt;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const rawText = await callClaude(apiKey, message);
    const jsonText = extractJson(rawText);

    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch (err) {
      lastError = new Error(`Ungültiges JSON von Claude: ${err.message}`);
      message = `${userPrompt}\n\nDeine letzte Antwort war kein gültiges JSON (Fehler: ${err.message}). Antworte erneut ausschließlich mit gültigem JSON gemäß Schema.`;
      continue;
    }

    try {
      validatePattern(parsed);
      return parsed;
    } catch (err) {
      lastError = err;
      message = `${userPrompt}\n\nDeine letzte Antwort war ungültig (${err.message}). Antworte erneut, korrigiere das Problem und halte dich exakt an das Schema.`;
    }
  }

  throw new UpstreamError(
    `Konnte nach ${MAX_ATTEMPTS} Versuchen kein gültiges Pattern erzeugen: ${lastError?.message}`,
    502
  );
}

export { UpstreamError };
