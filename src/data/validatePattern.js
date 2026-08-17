import { INSTRUMENTS, STEPS_PER_BAR } from './instruments.js';

const VALID_KEYS = new Set(INSTRUMENTS.map((i) => i.key));
const VALID_TIME_SIGNATURES = new Set(['4/4', '3/4', '6/8', '2/4', '5/4']);

// Leichte Laufzeit-Validierung gegen docs/drum-pattern-schema.md.
// Wirft bei Verstoß einen Error mit lesbarer Meldung statt stillem Fallback.
export function validatePattern(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('Pattern muss ein Objekt sein');
  }
  if (typeof data.bpm !== 'number' || data.bpm < 40 || data.bpm > 300) {
    throw new Error('bpm muss eine Zahl zwischen 40 und 300 sein');
  }
  if (!VALID_TIME_SIGNATURES.has(data.time_signature)) {
    throw new Error(`time_signature muss eine von ${[...VALID_TIME_SIGNATURES].join(', ')} sein`);
  }
  if (!Number.isInteger(data.bars) || data.bars < 1 || data.bars > 8) {
    throw new Error('bars muss eine ganze Zahl zwischen 1 und 8 sein');
  }
  if (!data.pattern || typeof data.pattern !== 'object' || Object.keys(data.pattern).length === 0) {
    throw new Error('pattern darf nicht leer sein');
  }

  const expectedLength = data.bars * STEPS_PER_BAR;
  for (const [key, steps] of Object.entries(data.pattern)) {
    if (!VALID_KEYS.has(key)) {
      throw new Error(`Unbekanntes Instrument "${key}". Erlaubt: ${[...VALID_KEYS].join(', ')}`);
    }
    if (!Array.isArray(steps) || steps.length !== expectedLength) {
      throw new Error(`"${key}" muss ein Array mit ${expectedLength} Steps sein (bars * ${STEPS_PER_BAR})`);
    }
    for (const v of steps) {
      if (!Number.isInteger(v) || v < 0 || v > 127) {
        throw new Error(`"${key}" enthält einen ungültigen Velocity-Wert: ${v} (erlaubt: 0-127)`);
      }
    }
  }

  return true;
}
