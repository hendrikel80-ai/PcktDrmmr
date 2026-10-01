import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { generatePattern } from './generatePattern.js';
import { soundLike } from './soundLike.js';
import { UpstreamError } from './aiProvider.js';
import { findLibraryMatch } from './library.js';
import { validatePattern } from '../src/data/validatePattern.js';
import { requireApiToken } from './auth.js';
import { rateLimit } from './rateLimit.js';

// Eigener Variablenname statt PORT: unter `npm run dev:full` (concurrently)
// erben sowohl der Vite- als auch der Backend-Prozess dieselbe Shell-Umgebung
// — eine generische PORT-Variable (z.B. vom Preview-Tool für Vites autoPort
// gesetzt) würde sonst versehentlich auch dieses Backend umleiten.
const PORT = process.env.API_PORT || 3001;
// Explizit an localhost binden statt der Node-Default (alle
// Netzwerk-Schnittstellen) — sonst wäre dieser Server, der pro Anfrage
// echtes Geld bei Anthropic/DeepSeek kostet, für jedes andere Gerät im
// selben WLAN direkt erreichbar, jedes Mal wenn "npm run dev:full" läuft,
// nicht erst über einen künftigen Tunnel. Mobile-Zugriff läuft weiterhin
// über Vites Dev-Server (der bleibt netzwerkweit erreichbar, siehe
// allowedHosts in vite.config.js), der /api-Anfragen serverseitig an
// diesen Prozess weiterreicht — das bleibt Loopback-zu-Loopback auf
// demselben Rechner und ist von dieser Einschränkung nicht betroffen.
const HOST = process.env.API_HOST || '127.0.0.1';
const MAX_PROMPT_LENGTH = 300;
const MAX_REFERENCE_PATTERNS = 5;

const app = express();
app.use(cors());
app.use(express.json());

// Nur auf den beiden Routen, die tatsächlich eine kostenpflichtige
// KI-API aufrufen — /api/health ist rein lokal und kostenlos, der braucht
// weder Token noch Limit (die Beat-Library ist im Frontend gebündelt, siehe
// src/data/beatLibraryData.js). Ein gemeinsamer Limiter
// für beide Routen, damit sich Kosten nicht durch Aufteilen auf beide
// Endpunkte umgehen lassen.
//
// Konfigurierbar statt hart codiert: Der Zähler bucket-t nach IP-Adresse
// (siehe rateLimit.js), aber ein Tunnel wie Tailscale Funnel reicht die
// echte Adresse externer Besucher nicht durch — alle von außen kommenden
// Anfragen landen dann effektiv im selben Bucket. Aus "20 pro Person pro
// 10 Minuten" wird dadurch "20 für alle Freunde zusammen pro 10 Minuten".
// Vor dem ersten Freischalten über einen Tunnel also bewusst RATE_LIMIT_MAX
// hochsetzen (siehe .env.example) statt sich von der Standardeinstellung
// überraschen zu lassen.
const aiRateLimit = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 10 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX) || 20,
});
const aiGuards = [requireApiToken, aiRateLimit];

app.post('/api/generate-pattern', aiGuards, async (req, res) => {
  const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';

  if (!prompt) {
    return res.status(400).json({ error: 'prompt must not be empty' });
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return res
      .status(400)
      .json({ error: `prompt must be at most ${MAX_PROMPT_LENGTH} characters long` });
  }

  const referencePatterns = Array.isArray(req.body?.referencePatterns)
    ? req.body.referencePatterns.slice(0, MAX_REFERENCE_PATTERNS)
    : [];

  // Beat-Library zuerst versuchen (kuratierte Patterns, kein API-Call,
  // gegen die Eintönigkeit einzeln live generierter Beats — siehe
  // CLAUDE.md-Aufgabe "Beat-Library mit Generator-Agent"). Nur bei einem
  // erkannten Genre-Stichwort im Prompt greift das; sonst unverändert
  // weiter zur Live-Generierung unten.
  const libraryMatch = findLibraryMatch(prompt);
  if (libraryMatch) {
    try {
      validatePattern(libraryMatch.pattern); // defensiv gegen manuell beschädigte Library-Dateien
      return res.json({ pattern: libraryMatch.pattern, fromCache: false, fromLibrary: true });
    } catch (err) {
      console.error('Library-Pattern ungültig, falle auf Live-Generierung zurück:', err.message);
    }
  }

  try {
    const { pattern, fromCache } = await generatePattern(prompt, referencePatterns);
    res.json({ pattern, fromCache });
  } catch (err) {
    const status = err instanceof UpstreamError ? err.status : 500;
    console.error('generate-pattern failed:', err.message);
    res.status(status).json({ error: err.message });
  }
});

app.post('/api/sound-like', aiGuards, async (req, res) => {
  const query = typeof req.body?.query === 'string' ? req.body.query.trim() : '';

  if (!query) {
    return res.status(400).json({ error: 'query must not be empty' });
  }
  if (query.length > MAX_PROMPT_LENGTH) {
    return res
      .status(400)
      .json({ error: `query must be at most ${MAX_PROMPT_LENGTH} characters long` });
  }

  try {
    const { suggestions, usedWebSearch, fromCache } = await soundLike(query);
    res.json({ suggestions, usedWebSearch, fromCache });
  } catch (err) {
    const status = err instanceof UpstreamError ? err.status : 500;
    console.error('sound-like failed:', err.message);
    res.status(status).json({ error: err.message });
  }
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, hasApiKey: Boolean(process.env.ANTHROPIC_API_KEY) });
});

app.listen(PORT, HOST, () => {
  console.log(`Pocket Studio API running on http://${HOST}:${PORT}`);
});
