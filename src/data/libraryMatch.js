// Gemeinsamer, umgebungsneutraler Kern der Beat-Library (kein fs, kein
// fetch) — genutzt vom Server (server/library.js, lädt die Dateien vom
// Dateisystem) und vom Frontend (src/data/beatLibraryData.js, bekommt sie
// zur Build-Zeit von Vite gebündelt). Das Frontend braucht dadurch für die
// Library keinen laufenden Server mehr, was im installierten Desktop-Build
// (kein Vite-Proxy, kein Express-Prozess) die Voraussetzung dafür ist, dass
// Library-Browser und Library-Treffer in "Generate a Beat" überhaupt
// funktionieren.
//
// Matching ist rein heuristisch (Alias-Stichwortsuche + BPM-Regex) statt
// eines zusätzlichen KI-Klassifikations-Calls — genau der Zusatz-Aufwand
// (Latenz + Kosten pro Anfrage), den die Library eigentlich vermeiden
// soll. Prompts ohne erkennbares Genre-Stichwort (z.B. Künstler-
// Referenzen) matchen bewusst nicht und fallen auf die Live-Generierung
// zurück.

import { LIBRARY_TAXONOMY } from '../../scripts/libraryTaxonomy.mjs';

const BPM_TOLERANCE = 15;

// files: [{ genreSlug, subgenreSlug, fileName, pattern }] in beliebiger
// Reihenfolge. Einträge außerhalb der Taxonomie werden ignoriert (wie
// zuvor der Ordner-Walk in server/library.js); Reihenfolge folgt der
// Taxonomie, innerhalb eines Subgenres dem Dateinamen — damit Server und
// Frontend dieselbe Liste in derselben Reihenfolge sehen.
export function buildLibraryIndex(files) {
  const entries = [];
  for (const [genreSlug, genre] of Object.entries(LIBRARY_TAXONOMY)) {
    for (const [subgenreSlug, subgenre] of Object.entries(genre.subgenres)) {
      const subgenreFiles = files
        .filter((f) => f.genreSlug === genreSlug && f.subgenreSlug === subgenreSlug)
        .sort((a, b) => a.fileName.localeCompare(b.fileName));
      for (const { pattern } of subgenreFiles) {
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
      }
    }
  }
  return entries;
}

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

// Liefert `{pattern}` bei Treffer, sonst `null` — der Aufrufer fällt dann
// auf die Live-Generierung zurück.
export function findLibraryMatch(index, promptText) {
  if (index.length === 0) return null;

  const promptLower = promptText.toLowerCase();
  const bpmHint = extractBpmHint(promptLower);

  const genreMatches = index.filter((e) => textMatchesAny(promptLower, e.genreAliases));
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
