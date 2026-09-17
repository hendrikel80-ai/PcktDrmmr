// Server-seitiger Matcher für die Beat-Library (siehe CLAUDE.md-Aufgabe
// "Beat-Library mit Generator-Agent"). Rein heuristisch (Alias-Stichwort-
// suche + BPM-Regex) statt eines zusätzlichen KI-Klassifikations-Calls —
// genau der Zusatz-Aufwand (Latenz + Kosten pro Anfrage), den die Library
// eigentlich vermeiden soll. Prompts ohne erkennbares Genre-Stichwort
// (z.B. Künstler-Referenzen) matchen bewusst nicht und fallen sauber auf
// die bestehende Live-Generierung zurück.
//
// Index wird einmal beim ersten Import aus dem Dateisystem aufgebaut
// (library/<genre>/<subgenre>/*.json) und im Speicher gehalten — die
// Library wächst offline über scripts/generate-library.mjs, nicht zur
// Laufzeit, ein Server-Neustart genügt um Neuzugänge sichtbar zu machen.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LIBRARY_TAXONOMY } from '../scripts/libraryTaxonomy.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LIBRARY_ROOT = join(__dirname, '..', 'library');
const BPM_TOLERANCE = 15;

function loadLibraryIndex() {
  const entries = [];
  for (const [genreSlug, genre] of Object.entries(LIBRARY_TAXONOMY)) {
    for (const [subgenreSlug, subgenre] of Object.entries(genre.subgenres)) {
      const dir = join(LIBRARY_ROOT, genreSlug, subgenreSlug);
      if (!existsSync(dir)) continue;
      for (const file of readdirSync(dir)) {
        if (!file.endsWith('.json')) continue;
        try {
          const pattern = JSON.parse(readFileSync(join(dir, file), 'utf8'));
          entries.push({
            genreSlug,
            subgenreSlug,
            genreLabel: genre.label,
            subgenreLabel: subgenre.label,
            genreAliases: genre.aliases,
            subgenreAliases: subgenre.aliases,
            bpmRange: subgenre.bpmRange,
            pattern,
          });
        } catch (err) {
          console.error(`[library] konnte ${join(dir, file)} nicht laden: ${err.message}`);
        }
      }
    }
  }
  return entries;
}

// Modul-weiter, einmalig aufgebauter Index — siehe Datei-Kommentar.
const LIBRARY_INDEX = loadLibraryIndex();
console.log(`[library] ${LIBRARY_INDEX.length} Patterns aus ${LIBRARY_ROOT} geladen`);

function extractBpmHint(promptText) {
  const match = promptText.match(/(\d{2,3})\s*bpm/i);
  return match ? parseInt(match[1], 10) : null;
}

// Längere/spezifischere Aliase zuerst prüfen, damit z.B. "pop punk" vor
// dem allgemeineren "punk" matcht.
function textMatchesAny(promptLower, aliases) {
  return [...aliases].sort((a, b) => b.length - a.length).some((alias) => promptLower.includes(alias));
}

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

// Liefert `{pattern}` bei Treffer, sonst `null` — der Aufrufer
// (server/index.js) fällt dann unverändert auf generatePattern() zurück.
export function findLibraryMatch(promptText) {
  if (LIBRARY_INDEX.length === 0) return null;

  const promptLower = promptText.toLowerCase();
  const bpmHint = extractBpmHint(promptLower);

  const genreMatches = LIBRARY_INDEX.filter((e) => textMatchesAny(promptLower, e.genreAliases));
  if (genreMatches.length === 0) return null;

  const subgenreMatches = genreMatches.filter((e) => textMatchesAny(promptLower, e.subgenreAliases));

  // Gestuftes Fallback: Subgenre+BPM -> Subgenre ohne BPM -> irgendein
  // Subgenre desselben Genres.
  let candidates = [];
  if (bpmHint) {
    candidates = subgenreMatches.filter(
      (e) => bpmHint >= e.bpmRange[0] - BPM_TOLERANCE && bpmHint <= e.bpmRange[1] + BPM_TOLERANCE
    );
  }
  if (candidates.length === 0) candidates = subgenreMatches;
  if (candidates.length === 0) candidates = genreMatches;
  if (candidates.length === 0) return null;

  // Tag-Treffer bevorzugen (nicht erzwingen) — falls Wörter aus dem
  // Prompt zu tags eines Kandidaten passen, nur aus dieser Teilmenge
  // zufällig wählen, sonst aus allen Kandidaten.
  const tagMatches = candidates.filter((e) =>
    (e.pattern.tags || []).some((tag) => promptLower.includes(String(tag).toLowerCase()))
  );
  const pool = tagMatches.length > 0 ? tagMatches : candidates;

  return { pattern: pickRandom(pool).pattern };
}

// Für die aktive Bibliotheks-Durchsuchung (LibraryBrowser.jsx) statt der
// heuristischen Prompt-Suche — liefert jeden Library-Eintrag mit Genre/
// Subgenre-Label und vollständigem Pattern, damit die UI ohne weiteren
// Request Genre -> Subgenre -> Pattern durchklicken kann (die Library ist
// klein genug, um komplett auf einmal zu übertragen).
export function listLibrary() {
  return LIBRARY_INDEX.map((e) => ({
    genreSlug: e.genreSlug,
    subgenreSlug: e.subgenreSlug,
    genreLabel: e.genreLabel,
    subgenreLabel: e.subgenreLabel,
    pattern: e.pattern,
  }));
}
