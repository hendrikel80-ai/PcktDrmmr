// Persists Amp-Panel settings (gain/tone stack/reverb/delay) locally in
// the browser — same reasoning and storage mechanism as patternStorage.js
// (no backend/DB needed for this use case).

const STORAGE_KEY = 'pocket-studio:amp-presets';

export function listAmpPresets() {
  return readAll().sort((a, b) => b.savedAt - a.savedAt);
}

export function saveAmpPreset(name, settings) {
  const all = readAll().filter((p) => p.name !== name);
  all.push({ name, settings, savedAt: Date.now() });
  writeAll(all);
}

export function loadAmpPreset(name) {
  const entry = readAll().find((p) => p.name === name);
  return entry ? entry.settings : null;
}

export function deleteAmpPreset(name) {
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

function writeAll(presets) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch {
    // localStorage unavailable - preset just won't persist this session
  }
}
