// True on any element that consumes keystrokes itself (typing a pattern
// name, editing the BPM field, nudging a slider) — global keyboard
// shortcuts (recording start/stop, undo, …) must not hijack those.
export function isTextEntryTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}
