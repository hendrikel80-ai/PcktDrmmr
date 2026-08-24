// Lokale Bibliothek für NAM-Amp-Modelle und Cabinet-IRs (IndexedDB statt
// localStorage, da .nam-Dateien mehrere hundert KB groß sind und
// localStorage typischerweise auf ~5-10MB begrenzt ist).
//
// Zwei Object Stores: "models" (.nam-Dateien als Text, NAM-Dateien sind
// JSON) und "irs" (Cabinet-Impulsantworten als ArrayBuffer).

const DB_NAME = 'pocket-drummer-amps';
const DB_VERSION = 1;
const STORE_MODELS = 'models';
const STORE_IRS = 'irs';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_MODELS)) {
        db.createObjectStore(STORE_MODELS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_IRS)) {
        db.createObjectStore(STORE_IRS, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db, storeName, mode) {
  return db.transaction(storeName, mode).objectStore(storeName);
}

function requestToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function isSupported() {
  return typeof indexedDB !== 'undefined';
}

// --- Amp-Modelle (.nam, Textinhalt) ---

export async function saveModel({ name, namText, sourceUrl }) {
  const db = await openDB();
  const entry = {
    id: crypto.randomUUID(),
    name,
    namText,
    sourceUrl: sourceUrl ?? null,
    addedAt: Date.now(),
  };
  await requestToPromise(tx(db, STORE_MODELS, 'readwrite').put(entry));
  return entry;
}

export async function listModels() {
  const db = await openDB();
  const all = await requestToPromise(tx(db, STORE_MODELS, 'readonly').getAll());
  return all.sort((a, b) => b.addedAt - a.addedAt);
}

export async function getModel(id) {
  const db = await openDB();
  return requestToPromise(tx(db, STORE_MODELS, 'readonly').get(id));
}

export async function deleteModel(id) {
  const db = await openDB();
  await requestToPromise(tx(db, STORE_MODELS, 'readwrite').delete(id));
}

// --- Cabinet-IRs (.wav, als ArrayBuffer) ---

export async function saveIR({ name, arrayBuffer, sourceUrl }) {
  const db = await openDB();
  const entry = {
    id: crypto.randomUUID(),
    name,
    arrayBuffer,
    sourceUrl: sourceUrl ?? null,
    addedAt: Date.now(),
  };
  await requestToPromise(tx(db, STORE_IRS, 'readwrite').put(entry));
  return entry;
}

export async function listIRs() {
  const db = await openDB();
  const all = await requestToPromise(tx(db, STORE_IRS, 'readonly').getAll());
  return all.sort((a, b) => b.addedAt - a.addedAt);
}

export async function getIR(id) {
  const db = await openDB();
  return requestToPromise(tx(db, STORE_IRS, 'readonly').get(id));
}

export async function deleteIR(id) {
  const db = await openDB();
  await requestToPromise(tx(db, STORE_IRS, 'readwrite').delete(id));
}
