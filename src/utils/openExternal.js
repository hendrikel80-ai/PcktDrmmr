import { isTauriRuntime } from './platform';

// A plain <a target="_blank"> (or a mailto: link) does nothing in the Tauri
// desktop shell on its own — there's no browser tab / mail client to hand
// it to directly. The opener plugin (src-tauri/src/lib.rs's
// tauri_plugin_opener::init() + capabilities/default.json's
// "opener:default") normally intercepts such clicks automatically via its
// own window-level listener, no JS glue needed — but a modal that calls
// stopPropagation() on its own clicks (to close on backdrop-click) stops
// the click from ever bubbling up to that listener. So callers inside such
// a modal need this explicit handler — using window.__TAURI__.core.invoke
// directly (the same low-level bridge every other Tauri call in this app
// already goes through) rather than window.__TAURI__.opener.openUrl, which
// depends on a separate, less reliably-bundled JS API surface.
export function openExternal(e, url, onError) {
  if (!isTauriRuntime()) return; // plain browser tab/mail client: let the normal <a> handle it
  e.preventDefault();
  window.__TAURI__.core.invoke('plugin:opener|open_url', { url }).catch((err) => {
    console.error(err);
    onError?.(err?.message || String(err));
  });
}
