// Persistiert Patterns lokal im Browser (localStorage). Bewusst kein
// Backend/DB — siehe CLAUDE.md "Offene Entscheidungen": für den Übungs-
// Use-Case reicht clientseitige Persistenz völlig aus.

import { validatePattern } from './validatePattern';

const STORAGE_KEY = 'pocket-drummer:patterns';

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
