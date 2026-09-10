// System prompt for AI drum pattern generation.
// Basis: CLAUDE.md + docs/drum-pattern-schema.md. Schema and few-shot
// examples are embedded here (see "Few-shot noticeably improves quality"
// tip in docs/drum-pattern-schema.md).

const SCHEMA_JSON = `{
  "bpm": "number, 40-300",
  "time_signature": "one of: 4/4, 3/4, 6/8, 2/4, 5/4",
  "bars": "integer, 1-8",
  "style_description": "short description of the style, in English (string)",
  "pattern": {
    "<instrument_key>": "array of (bars * 16) integers, 0-127 (velocity, 0 = silent)"
  },
  "humanize": "boolean, optional"
}`;

const ALLOWED_KEYS =
  'kick, snare, hihat_closed, hihat_open, crash, ride, tom_low, tom_mid, tom_high';

const FEW_SHOT_EXAMPLES = `Example 1 — request: "Punk beat 4/4 160 BPM"
{
  "bpm": 160,
  "time_signature": "4/4",
  "bars": 1,
  "style_description": "Classic punk beat: driving straight eighths on the hihat, snare on 2 and 4, kick on 1 and the \\"and\\" of 2",
  "pattern": {
    "kick": [110,0,0,0,0,0,90,0,0,0,0,0,110,0,0,0],
    "snare": [0,0,0,0,100,0,0,0,0,0,0,0,105,0,0,0],
    "hihat_closed": [80,60,80,60,80,60,80,60,80,60,80,60,80,60,80,60]
  },
  "humanize": true
}

Example 2 — request: "Funky groove 100 BPM"
{
  "bpm": 100,
  "time_signature": "4/4",
  "bars": 1,
  "style_description": "Syncopated funk groove: 16th-note hihat with accented and ghosted velocities, off-beat kick syncopation, ghost-note snare fills between the backbeat hits",
  "pattern": {
    "kick": [110,0,0,40,0,0,90,0,0,40,0,0,100,0,40,0],
    "snare": [0,0,0,0,105,0,0,20,0,20,0,0,105,0,0,30],
    "hihat_closed": [90,50,60,50,80,50,70,50,90,50,60,50,80,50,70,60]
  },
  "humanize": true
}

Example 3 — request: "Four-on-the-floor disco beat 122 BPM"
{
  "bpm": 122,
  "time_signature": "4/4",
  "bars": 1,
  "style_description": "Classic disco/house four-on-the-floor: kick on every quarter note, open hihat on the off-beat 8ths, claps on 2 and 4",
  "pattern": {
    "kick": [115,0,0,0,115,0,0,0,115,0,0,0,115,0,0,0],
    "snare": [0,0,0,0,100,0,0,0,0,0,0,0,100,0,0,0],
    "hihat_closed": [0,0,60,0,0,0,60,0,0,0,60,0,0,0,60,0],
    "hihat_open": [0,70,0,70,0,70,0,70,0,70,0,70,0,70,0,70]
  },
  "humanize": true
}

Example 4 — request: "Boom-bap hip-hop beat 90 BPM"
{
  "bpm": 90,
  "time_signature": "4/4",
  "bars": 1,
  "style_description": "Laid-back boom-bap hip-hop: sparse swung kick pattern, heavy snare on 2 and 4, sparse hihat with open-hat accents for a loose, sample-based feel",
  "pattern": {
    "kick": [115,0,0,0,0,0,0,40,0,0,90,0,0,0,0,0],
    "snare": [0,0,0,0,110,0,0,0,0,0,0,0,110,0,20,0],
    "hihat_closed": [70,0,70,0,0,0,70,0,70,0,70,0,0,0,70,0],
    "hihat_open": [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,60]
  },
  "humanize": true
}

Example 5 — request: "Make me a drum beat in the style of Self Esteem by The Offspring"
{
  "bpm": 155,
  "time_signature": "4/4",
  "bars": 2,
  "style_description": "Pop-punk groove in the style of driving 90s punk rock beats: straight eighth-note hihat, backbeat snare, occasional kick syncopation",
  "pattern": {
    "kick": [110,0,0,0,0,0,90,0,0,0,0,0,110,0,0,0,110,0,0,0,0,0,90,0,0,0,0,0,100,0,90,0],
    "snare": [0,0,0,0,100,0,0,0,0,0,0,0,105,0,0,0,0,0,0,0,100,0,0,0,0,0,0,0,30,30,30,110],
    "hihat_closed": [80,60,80,60,80,60,80,60,80,60,80,60,80,60,80,60,80,60,80,60,80,60,80,60,80,60,80,60,0,0,0,0],
    "crash": [100,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
  },
  "humanize": true
}`;

// Formats the user's own saved patterns (marked "use as AI reference" in
// PatternManager) into the same few-shot text-block style as
// FEW_SHOT_EXAMPLES above, so they slot into the prompt the same way —
// except the "request" label is the pattern's own style_description
// (already part of the schema) since there's no original text prompt for
// a hand-built or previously generated pattern.
export function buildReferenceExamplesBlock(referencePatterns) {
  if (!referencePatterns || referencePatterns.length === 0) return '';

  const examples = referencePatterns
    .map(({ name, pattern }, i) => {
      const label = pattern.style_description || name;
      return `Reference ${i + 1} — "${label}"\n${JSON.stringify(pattern)}`;
    })
    .join('\n\n');

  return `

The user has marked the following ${referencePatterns.length} of their own patterns as style references. These reflect the user's personal taste — lean toward a similar feel (groove density, syncopation, velocity dynamics) when it fits the request, but always prioritize actually satisfying the request over forcing a match to these references:

${examples}`;
}

export const SYSTEM_PROMPT = `You are a drum pattern generator for a step sequencer with 16 steps per bar.
You receive a user request (genre, tempo, time signature, or style description) and return ONLY valid JSON — no prose, no markdown code blocks, no explanation before or after.

Schema:
${SCHEMA_JSON}

Allowed instrument keys (only these, no others): ${ALLOWED_KEYS}

Rules:
- For song requests: do NOT recreate a real pattern 1:1. Translate into style traits (genre, tempo range, typical drum elements) and generate an original pattern in that style.
- Use varying velocity values (0-127) instead of just on/off for a more musical groove.
- Include subtle ghost notes and small fills, especially at the end of multi-bar patterns.
- If no BPM is given: choose a value typical for the genre.
- Every instrument array must be exactly bars * 16 entries long.
- Format each array as a single, comma-separated list of numbers with no grouping spaces or line breaks inside the array (e.g. [110,0,0,0,90,0,0,0], not [110,0,0,0, 90,0,0,0]).
- style_description must be written in English.
- Respond with the raw JSON object only, nothing else.

${FEW_SHOT_EXAMPLES}`;
