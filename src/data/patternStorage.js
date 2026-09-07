// Persistiert Patterns lokal im Browser (localStorage). Bewusst kein
// Backend/DB — siehe CLAUDE.md "Offene Entscheidungen": für den Übungs-
// Use-Case reicht clientseitige Persistenz völlig aus.

import { validatePattern } from './validatePattern';

const STORAGE_KEY = 'pocket-studio:patterns';
const LEGACY_STORAGE_KEY = 'pocket-drummer:patterns';

// Einmalige, stille Migration nach der Umbenennung von Pocket Drummer zu
// Pocket Studio — sonst wuerden bereits gespeicherte Patterns unter dem
// alten Storage-Key nach dem Update ploetzlich unsichtbar.
(function migrateLegacyStorage() {
  try {
    if (localStorage.getItem(STORAGE_KEY) !== null) return; // schon migriert oder frisch
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy !== null) {
      localStorage.setItem(STORAGE_KEY, legacy);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    }
  } catch {
    // localStorage nicht verfuegbar - nichts zu migrieren
  }
})();

export function listPatterns() {
  return readAll().sort((a, b) => b.savedAt - a.savedAt);
}

export function savePattern(name, pattern) {
  const all = readAll().filter((p) => p.name !== name);
  all.push({ name, pattern, savedAt: Date.now() });
  writeAll(all);
}

export function loadPattern(name) {
  const entry = readAll().find((p) => p.name === name);
  if (!entry) return null;
  try {
    validatePattern(entry.pattern);
  } catch {
    return null; // korrupter/manuell editierter localStorage-Eintrag
  }
  return entry.pattern;
}

export function deletePattern(name) {
  writeAll(readAll().filter((p) => p.name !== name));
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

function writeAll(patterns) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(patterns));
}
