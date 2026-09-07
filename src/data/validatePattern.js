import { INSTRUMENTS, STEPS_PER_BAR } from './instruments.js';

const VALID_KEYS = new Set(INSTRUMENTS.map((i) => i.key));
const VALID_TIME_SIGNATURES = new Set(['4/4', '3/4', '6/8', '2/4', '5/4']);

// Leichte Laufzeit-Validierung gegen docs/drum-pattern-schema.md.
// Wirft bei Verstoß einen Error mit lesbarer Meldung statt stillem Fallback.
export function validatePattern(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('pattern must be an object');
  }
  if (typeof data.bpm !== 'number' || data.bpm < 40 || data.bpm > 300) {
    throw new Error('bpm must be a number between 40 and 300');
  }
  if (!VALID_TIME_SIGNATURES.has(data.time_signature)) {
    throw new Error(`time_signature must be one of ${[...VALID_TIME_SIGNATURES].join(', ')}`);
  }
  if (!Number.isInteger(data.bars) || data.bars < 1 || data.bars > 8) {
    throw new Error('bars must be an integer between 1 and 8');
  }
  if (!data.pattern || typeof data.pattern !== 'object' || Object.keys(data.pattern).length === 0) {
    throw new Error('pattern must not be empty');
  }

  const expectedLength = data.bars * STEPS_PER_BAR;
  for (const [key, steps] of Object.entries(data.pattern)) {
    if (!VALID_KEYS.has(key)) {
      throw new Error(`Unknown instrument "${key}". Allowed: ${[...VALID_KEYS].join(', ')}`);
    }
    if (!Array.isArray(steps) || steps.length !== expectedLength) {
      throw new Error(`"${key}" must be an array with ${expectedLength} steps (bars * ${STEPS_PER_BAR})`);
    }
    for (const v of steps) {
      if (!Number.isInteger(v) || v < 0 || v > 127) {
        throw new Error(`"${key}" contains an invalid velocity value: ${v} (allowed: 0-127)`);
      }
    }
  }

  return true;
}
