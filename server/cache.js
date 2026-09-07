import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Kleine dateibasierte "Datenbank" fürs Zwischenspeichern von KI-Antworten:
// gleiche Anfrage (Beat-Prompt oder Sound-Like-Query) muss nicht erneut an
// die API geschickt werden, spart Tokens/Kosten und ist sofort verfügbar.
// Kein SQLite/etc. nötig für diesen Umfang — eine JSON-Datei pro Feature,
// im Repo unter server/data/ ablegbar und damit direkt einsehbar/versionierbar.
const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), 'data');

function normalizeKey(text) {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

function loadStore(filePath) {
  if (!existsSync(filePath)) return {};
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch {
    // Beschädigte/leere Cache-Datei darf die App nicht blockieren — einfach
    // wie ein leerer Cache behandeln, nächster Schreibvorgang repariert sie.
    return {};
  }
}

function saveStore(filePath, store) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(store, null, 2), 'utf-8');
}

export function getCached(fileName, key) {
  const store = loadStore(join(DATA_DIR, fileName));
  const entry = store[normalizeKey(key)];
  return entry ? entry.value : undefined;
}

export function setCached(fileName, key, value) {
  const filePath = join(DATA_DIR, fileName);
  const store = loadStore(filePath);
  store[normalizeKey(key)] = { value, cachedAt: new Date().toISOString() };
  saveStore(filePath, store);
}
