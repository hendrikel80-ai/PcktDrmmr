import { validatePattern } from '../src/data/validatePattern.js';
import { SYSTEM_PROMPT, buildReferenceExamplesBlock } from './systemPrompt.js';
import { callChatModel, UpstreamError } from './aiProvider.js';
import { getCached, setCached } from './cache.js';

const MAX_TOKENS = 1500;
const MAX_ATTEMPTS = 2; // 1 Versuch + 1 Retry bei ungültigem JSON
const CACHE_FILE = 'patternCache.json';
const MAX_REFERENCE_PATTERNS = 5;

// Drops anything malformed rather than failing the whole request — these
// come from the user's own saved patterns, which are always app-shaped in
// practice, but validating defensively costs nothing.
function sanitizeReferencePatterns(referencePatterns) {
  if (!Array.isArray(referencePatterns)) return [];
  return referencePatterns
    .filter((entry) => entry && typeof entry.name === 'string' && entry.pattern)
    .filter((entry) => {
      try {
        validatePattern(entry.pattern);
        return true;
      } catch {
        return false;
      }
    })
    .slice(0, MAX_REFERENCE_PATTERNS);
}

// Cache key must include which reference patterns were active — otherwise
// the same prompt text with vs. without references (or a different
// reference set) would collide on one cache entry. `savedAt` is bumped by
// patternStorage.savePattern() on every re-save, so name+savedAt also
// invalidates the cache when a reference pattern's content changes.
function referenceSignature(referencePatterns) {
  return referencePatterns
    .map((p) => `${p.name}@${p.savedAt}`)
    .sort()
    .join('|');
}

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

export async function generatePattern(userPrompt, referencePatterns = []) {
  const references = sanitizeReferencePatterns(referencePatterns);
  const cacheKey = `${userPrompt}::refs=${referenceSignature(references)}`;
  const system = SYSTEM_PROMPT + buildReferenceExamplesBlock(references);

  const cached = getCached(CACHE_FILE, cacheKey);
  if (cached) {
    return { pattern: cached, fromCache: true };
  }

  let lastError;
  let message = userPrompt;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const { text: rawText } = await callChatModel({
      system,
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
      setCached(CACHE_FILE, cacheKey, parsed);
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
