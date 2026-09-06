// Detects whether the app is running inside the native Tauri shell
// (window.__TAURI__ is only injected there — requires app.withGlobalTauri
// in tauri.conf.json — vs. a plain browser tab). Used to switch between
// GuitarEngine (Web Audio, browser) and NativeGuitarEngine (Tauri IPC,
// real ASIO) without touching anything else in the app.
export function isTauriRuntime() {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}
