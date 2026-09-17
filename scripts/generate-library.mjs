// Batch-Generator für die Beat-Library (siehe CLAUDE.md-Aufgabe
// "Beat-Library mit Generator-Agent"). Läuft eigenständig via
// `npm run generate-library` (kein Express-Kontext — deshalb der eigene
// dotenv-Import unten), ruft pro Subgenre mehrfach die konfigurierte
// KI-API mit variierenden Zusatz-Anweisungen auf und schreibt die
// Ergebnisse nach library/<genre>/<subgenre>/beat_NNN.json.
//
// Wiederholt ausführbar: zählt pro Subgenre-Ordner von den bereits
// vorhandenen beat_*.json weiter, überschreibt nichts.
//
// CLI-Flags (alle optional, ohne sie läuft die komplette Taxonomie —
// Vorsicht, das kostet entsprechend viele API-Calls):
//   --genre=punk           nur dieses Genre
//   --subgenre=street-punk nur dieses Subgenre (impliziert --genre)
//   --count=6              Varianten pro Subgenre (Default 6)
import 'dotenv/config';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { callChatModel } from '../server/aiProvider.js';
import { SYSTEM_PROMPT } from '../server/systemPrompt.js';
import { extractJson, repairMissingArrayCommas } from '../server/generatePattern.js';
import { validatePattern } from '../src/data/validatePattern.js';
import { INSTRUMENTS, STEPS_PER_BAR } from '../src/data/instruments.js';
import { LIBRARY_TAXONOMY } from './libraryTaxonomy.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LIBRARY_ROOT = join(__dirname, '..', 'library');
const MAX_TOKENS = 1500;
const DEFAULT_COUNT = 6;
// Über diesem Anteil identischer Steps im ersten Takt gilt ein neues
// Pattern als Near-Duplikat eines bereits gespeicherten und wird
// verworfen statt geschrieben (siehe Plan: kein Retry, nur überspringen).
const SIMILARITY_THRESHOLD = 0.85;

function parseArgs(argv) {
  const args = { count: DEFAULT_COUNT };
  for (const raw of argv) {
    const match = raw.match(/^--([a-z]+)=(.+)$/i);
    if (!match) continue;
    const [, key, value] = match;
    if (key === 'count') args.count = Math.max(1, parseInt(value, 10) || DEFAULT_COUNT);
    else args[key] = value;
  }
  return args;
}

function slugMatches(configuredGenre, configuredSubgenre, wantedGenre, wantedSubgenre) {
  if (wantedGenre && configuredGenre !== wantedGenre) return false;
  if (wantedSubgenre && configuredSubgenre !== wantedSubgenre) return false;
  return true;
}

// Binarisiert (an/aus statt Velocity) den ersten Takt eines einzelnen
// Instruments — nur der erste Takt, damit Patterns mit unterschiedlicher
// Taktzahl trotzdem vergleichbar bleiben.
function firstBarBits(pattern, key) {
  const steps = pattern[key];
  const bits = [];
  for (let i = 0; i < STEPS_PER_BAR; i++) {
    bits.push(steps && steps[i] > 0 ? 1 : 0);
  }
  return bits;
}

// Vergleicht nur Instrumente, die in MINDESTENS einem der beiden Patterns
// im ersten Takt tatsächlich etwas spielen — die meisten der 9 möglichen
// Instrumente bleiben in einem typischen (3-5-stimmigen) Pattern stumm,
// und "beide still" würde sonst als triviale Übereinstimmung mitgezählt
// und den Score künstlich hochtreiben, unabhängig von der musikalischen
// Ähnlichkeit der tatsächlich gespielten Stimmen.
function similarity(patternA, patternB) {
  let same = 0;
  let total = 0;
  for (const { key } of INSTRUMENTS) {
    const a = firstBarBits(patternA, key);
    const b = firstBarBits(patternB, key);
    if (!a.includes(1) && !b.includes(1)) continue; // beide stumm - kein Vergleichssignal
    for (let i = 0; i < STEPS_PER_BAR; i++) {
      total++;
      if (a[i] === b[i]) same++;
    }
  }
  return total === 0 ? 1 : same / total;
}

function nextFileIndex(dir) {
  if (!existsSync(dir)) return 1;
  const existing = readdirSync(dir)
    .map((f) => f.match(/^beat_(\d+)\.json$/))
    .filter(Boolean)
    .map((m) => parseInt(m[1], 10));
  return existing.length === 0 ? 1 : Math.max(...existing) + 1;
}

function loadExistingPatterns(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      try {
        return JSON.parse(readFileSync(join(dir, f), 'utf8')).pattern;
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

async function generateOne({ genreSlug, genreLabel, subgenreSlug, subgenre, variation }) {
  const bpmHint = Math.round((subgenre.bpmRange[0] + subgenre.bpmRange[1]) / 2);
  const userMessage = `${genreLabel} - ${subgenre.label} beat, around ${bpmHint} BPM. ${variation}.`;

  const { text: rawText } = await callChatModel({
    system: SYSTEM_PROMPT,
    userMessage,
    maxTokens: MAX_TOKENS,
  });

  const jsonText = extractJson(rawText);
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    parsed = JSON.parse(repairMissingArrayCommas(jsonText)); // wirft weiter, falls das auch scheitert
  }

  validatePattern(parsed); // wirft bei Schema-Verstoß

  return {
    genre: genreSlug,
    subgenre: subgenreSlug,
    tags: [variation.split(' ').slice(0, 3).join(' ')], // grober Tag-Hinweis aus der Variations-Anweisung
    ...parsed,
  };
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  let generated = 0;
  let skippedDuplicates = 0;
  let failed = 0;

  for (const [genreSlug, genre] of Object.entries(LIBRARY_TAXONOMY)) {
    for (const [subgenreSlug, subgenre] of Object.entries(genre.subgenres)) {
      if (!slugMatches(genreSlug, subgenreSlug, args.genre, args.subgenre)) continue;

      const dir = join(LIBRARY_ROOT, genreSlug, subgenreSlug);
      mkdirSync(dir, { recursive: true });
      let index = nextFileIndex(dir);
      const existingPatterns = loadExistingPatterns(dir);

      console.log(`\n[generate-library] ${genre.label} / ${subgenre.label} — ${args.count} Varianten`);

      for (let i = 0; i < args.count; i++) {
        const variation = subgenre.variations[i % subgenre.variations.length];
        try {
          const result = await generateOne({
            genreSlug,
            genreLabel: genre.label,
            subgenreSlug,
            subgenre,
            variation,
          });

          const maxSimilarity = Math.max(0, ...existingPatterns.map((existing) => similarity(existing, result.pattern)));
          if (maxSimilarity >= SIMILARITY_THRESHOLD) {
            skippedDuplicates++;
            console.log(
              `  ✗ verworfen (${Math.round(maxSimilarity * 100)}% ähnlich zu vorhandenem Pattern): "${variation}"`
            );
            continue;
          }

          const filename = `beat_${String(index).padStart(3, '0')}.json`;
          writeFileSync(join(dir, filename), JSON.stringify(result, null, 2), 'utf8');
          existingPatterns.push(result.pattern);
          index++;
          generated++;
          console.log(`  ✓ ${filename} ("${variation}")`);
        } catch (err) {
          failed++;
          console.error(`  ✗ Fehler bei "${variation}": ${err.message}`);
        }
      }
    }
  }

  console.log(
    `\n[generate-library] fertig — ${generated} neue Patterns, ${skippedDuplicates} als Near-Duplikat verworfen, ${failed} Fehler.`
  );
}

run().catch((err) => {
  console.error('[generate-library] Abbruch:', err);
  process.exit(1);
});
