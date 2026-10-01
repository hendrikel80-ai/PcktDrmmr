// Basis-Adresse des KI-Backends (server/). Leer = relative URLs, wie im
// Dev-Modus, wo Vite /api an den lokalen Express-Server weiterreicht. Der
// installierte Desktop-Build hat weder Vite-Proxy noch einen mitgelieferten
// Server — dort funktionieren die KI-Funktionen nur, wenn beim Bauen
// VITE_API_BASE_URL auf ein gehostetes Backend zeigt (siehe .env.example).
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

export function apiUrl(path) {
  return API_BASE_URL + path;
}

// false nur im fertig gebauten Tauri-Programm ohne konfiguriertes Backend
// — dann gibt es mit Sicherheit keinen Server unter der relativen Adresse,
// und die UI sagt das lieber vorab, statt den Nutzer in einen Fehler
// laufen zu lassen. In jedem anderen Fall (Dev, Web/Mobile-Build) bleibt
// es beim Versuch; scheitert der, greift die normale Fehlermeldung.
export function isAiBackendAvailable() {
  if (API_BASE_URL) return true;
  const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;
  return !(isTauri && import.meta.env.PROD);
}

// Nutzerfreundliche Meldung, wenn der Server gar nicht antwortet; der
// technische Hinweis auf "npm run dev:full" nur im Dev-Modus.
export function backendUnreachableMessage(status) {
  return import.meta.env.DEV
    ? `Server unreachable (status ${status}). Is the backend running? ("npm run dev:full" instead of just "npm run dev")`
    : 'The AI service is currently unreachable. Please try again later.';
}

// Hängt den optionalen Shared-Secret-Token (siehe server/auth.js) an
// Requests an die KI-Endpunkte an, wenn VITE_API_ACCESS_TOKEN gesetzt ist.
// Im normalen lokalen Setup (kein Tunnel) ist die Variable leer und das
// hier ist ein no-op — Header bleibt wie vorher nur Content-Type.
export function apiHeaders() {
  const token = import.meta.env.VITE_API_ACCESS_TOKEN;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}
