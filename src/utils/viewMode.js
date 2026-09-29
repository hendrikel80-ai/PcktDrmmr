// Jam vs. Songwriting mode (see App.jsx/MobileApp.jsx) — a simple, quick-
// jam-friendly view that hides the Build a Song section, vs. the full page
// including it. Persisted like the other UI preferences in this app so the
// choice survives a restart; defaults to Jam since that's the app's
// original, simpler use case (see CLAUDE.md's "Ziel").
const VIEW_MODE_STORAGE_KEY = 'pocket-studio:view-mode';

export const VIEW_MODES = {
  JAM: 'jam',
  SONGWRITING: 'songwriting',
};

export function readStoredViewMode() {
  try {
    const raw = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    return raw === VIEW_MODES.SONGWRITING ? VIEW_MODES.SONGWRITING : VIEW_MODES.JAM;
  } catch {
    return VIEW_MODES.JAM;
  }
}

export function writeViewMode(mode) {
  try {
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
  } catch {
    // localStorage unavailable - the choice just won't persist
  }
}
