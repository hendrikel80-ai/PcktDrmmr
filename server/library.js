// Server-seitiger Zugriff auf die Beat-Library (siehe CLAUDE.md-Aufgabe
// "Beat-Library mit Generator-Agent"). Matching-Logik liegt in
// src/data/libraryMatch.js, gemeinsam mit dem Frontend, das die Library
// selbst gebündelt hat und für Library-Treffer gar keinen Server mehr
// braucht. Hier bleibt sie für Clients, die /api/generate-pattern direkt
// mit einem Genre-Prompt aufrufen.
//
// Index wird einmal beim ersten Import aus dem Dateisystem aufgebaut
// (library/<genre>/<subgenre>/*.json) und im Speicher gehalten — die
// Library wächst offline über scripts/generate-library.mjs, nicht zur
// Laufzeit, ein Server-Neustart genügt um Neuzugänge sichtbar zu machen.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LIBRARY_TAXONOMY } from '../scripts/libraryTaxonomy.mjs';
import { buildLibraryIndex, findLibraryMatch as matchInIndex } from '../src/data/libraryMatch.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LIBRARY_ROOT = join(__dirname, '..', 'library');

function loadLibraryFiles() {
  const files = [];
  for (const [genreSlug, genre] of Object.entries(LIBRARY_TAXONOMY)) {
    for (const subgenreSlug of Object.keys(genre.subgenres)) {
      const dir = join(LIBRARY_ROOT, genreSlug, subgenreSlug);
      if (!existsSync(dir)) continue;
      for (const fileName of readdirSync(dir)) {
        if (!fileName.endsWith('.json')) continue;
        try {
          const pattern = JSON.parse(readFileSync(join(dir, fileName), 'utf8'));
          files.push({ genreSlug, subgenreSlug, fileName, pattern });
        } catch (err) {
          console.error(`[library] konnte ${join(dir, fileName)} nicht laden: ${err.message}`);
        }
      }
    }
  }
  return files;
}

// Modul-weiter, einmalig aufgebauter Index — siehe Datei-Kommentar.
const LIBRARY_INDEX = buildLibraryIndex(loadLibraryFiles());
console.log(`[library] ${LIBRARY_INDEX.length} Patterns geladen`);

export function findLibraryMatch(promptText) {
  return matchInIndex(LIBRARY_INDEX, promptText);
}
