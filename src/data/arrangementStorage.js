// Persists Song-/Arrangement-Mode playlists locally in the browser — same
// mechanism and reasoning as patternStorage.js. An arrangement is just an
// ordered list of *references* to already-saved patterns (by name) plus a
// repeat count each; it doesn't embed pattern data itself, so renaming a
// referenced pattern in the Pattern Manager silently breaks the reference
// (see ArrangementEditor.jsx's handling of a missing pattern).

const STORAGE_KEY = 'pocket-studio:arrangements';

export function listArrangements() {
  return readAll().sort((a, b) => b.savedAt - a.savedAt);
}

export function saveArrangement(name, entries, loopArrangement) {
  const all = readAll().filter((a) => a.name !== name);
  all.push({ name, entries, loopArrangement: Boolean(loopArrangement), savedAt: Date.now() });
  writeAll(all);
}

export function loadArrangement(name) {
  const entry = readAll().find((a) => a.name === name);
  return entry ?? null;
}

export function deleteArrangement(name) {
  writeAll(readAll().filter((a) => a.name !== name));
}

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(arrangements) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arrangements));
  } catch {
    // localStorage unavailable - the arrangement just won't persist
  }
}
