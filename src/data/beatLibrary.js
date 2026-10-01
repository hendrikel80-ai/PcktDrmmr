// Lädt den Library-Index einmalig (eigener Chunk, siehe
// beatLibraryData.js) und teilt das Promise zwischen LibraryBrowser,
// ArrangementEditor und PromptBar.
let indexPromise = null;

export function loadBeatLibrary() {
  indexPromise ??= import('./beatLibraryData').then((m) => m.LIBRARY_INDEX);
  return indexPromise;
}
