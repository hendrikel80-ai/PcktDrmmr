// Tauri command rejections for a Rust `Result<T, String>` reject the JS
// promise with a plain string, not an Error object — err.message on a
// string is always undefined, which would otherwise silently swallow every
// native error. Handle both shapes.
export function formatError(err) {
  if (typeof err === 'string') return err;
  return err?.message || String(err);
}
