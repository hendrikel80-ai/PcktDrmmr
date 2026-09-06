import { validatePattern } from '../src/data/validatePattern.js';
import { SYSTEM_PROMPT } from './systemPrompt.js';
import { callChatModel, UpstreamError } from './aiProvider.js';

const MAX_TOKENS = 1500;
const MAX_ATTEMPTS = 2; // 1 Versuch + 1 Retry bei ungültigem JSON

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
        lastError = new Error(`Ungültiges JSON vom Modell: ${err.message}`);
        message = `${userPrompt}\n\nDeine letzte Antwort war kein gültiges JSON (Fehler: ${err.message}). Antworte erneut ausschließlich mit gültigem JSON gemäß Schema.`;
        continue;
      }
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
