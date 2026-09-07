import { validatePattern } from '../src/data/validatePattern.js';
import { SYSTEM_PROMPT } from './systemPrompt.js';
import { callChatModel, UpstreamError } from './aiProvider.js';
import { getCached, setCached } from './cache.js';

const MAX_TOKENS = 1500;
const MAX_ATTEMPTS = 2; // 1 Versuch + 1 Retry bei ungültigem JSON
const CACHE_FILE = 'patternCache.json';

// Entfernt versehentliche Markdown-Codefences, falls das Modell sie trotz
// Anweisung mal ausgibt.
function extractJson(rawText) {
  const trimmed = rawText.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1] : trimmed;
}

// Reparatur-Fallback: unser Schema hat nirgends zwei durch Leerzeichen
// getrennte nackte Zahlen ohne Komma dazwischen — kommt das trotzdem vor
// (z.B. fehlendes Komma an einer Gruppengrenze im Pattern-Array), ist das
// Einfügen eines Kommas ein sicherer Reparaturversuch, bevor ein ganzer
// Retry-Request verbraucht wird.
function repairMissingArrayCommas(jsonText) {
  return jsonText.replace(/(-?\d+)(\s+)(?=-?\d)/g, '$1,');
}

export async function generatePattern(userPrompt) {
  const cached = getCached(CACHE_FILE, userPrompt);
  if (cached) {
    return { pattern: cached, fromCache: true };
  }

  let lastError;
  let message = userPrompt;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const { text: rawText } = await callChatModel({
      system: SYSTEM_PROMPT,
      userMessage: message,
      maxTokens: MAX_TOKENS,
    });
    const jsonText = extractJson(rawText);

    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch (err) {
      try {
        parsed = JSON.parse(repairMissingArrayCommas(jsonText));
      } catch {
        lastError = new Error(`Invalid JSON from the model: ${err.message}`);
        message = `${userPrompt}\n\nYour last response was not valid JSON (error: ${err.message}). Respond again with valid JSON only, matching the schema.`;
        continue;
      }
    }

    try {
      validatePattern(parsed);
      setCached(CACHE_FILE, userPrompt, parsed);
      return { pattern: parsed, fromCache: false };
    } catch (err) {
      lastError = err;
      message = `${userPrompt}\n\nYour last response was invalid (${err.message}). Respond again, fix the issue, and follow the schema exactly.`;
    }
  }

  throw new UpstreamError(
    `Could not produce a valid pattern after ${MAX_ATTEMPTS} attempts: ${lastError?.message}`,
    502
  );
}
