// Die komplette Beat-Library (library/<genre>/<subgenre>/*.json), zur
// Build-Zeit von Vite eingebettet statt zur Laufzeit von /api/library
// geholt — der installierte Desktop-Build hat keinen Server, der das
// liefern könnte. Nur über beatLibrary.js per dynamischem Import laden,
// damit die ~120 Patterns in einem eigenen Chunk landen und den
// App-Start nicht verlangsamen.

import { buildLibraryIndex } from './libraryMatch';

const modules = import.meta.glob('../../library/*/*/*.json', { eager: true, import: 'default' });

export const LIBRARY_INDEX = buildLibraryIndex(
  Object.entries(modules).map(([path, pattern]) => {
    const [genreSlug, subgenreSlug, fileName] = path.split('/').slice(-3);
    return { genreSlug, subgenreSlug, fileName, pattern };
  })
);
