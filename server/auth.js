// Optionaler Shared-Secret-Schutz für die kostenpflichtigen KI-Endpunkte
// (/api/generate-pattern, /api/sound-like). Ohne gesetztes
// API_ACCESS_TOKEN (Standard beim lokalen Entwickeln über
// "npm run dev:full") tut das hier nichts — relevant wird es erst, sobald
// der Server mal über einen Tunnel wie Tailscale Funnel von außen
// erreichbar ist (siehe CLAUDE.md: "HTTPS für Mobile-Mikrofonzugriff").
//
// Kein Schutz gegen einen Angreifer, der gezielt das gebündelte
// Frontend-JS ausliest — der Token landet zwangsläufig auch dort (siehe
// VITE_API_ACCESS_TOKEN), es ist also kein echtes Auth-Geheimnis gegenüber
// jemandem, der die App-URL kennt und nachschaut. Der eigentliche Zweck:
// wahllose Bots/Scanner draußen halten, die offene KI-Endpunkte im Netz
// abklappern und sonst einfach die Anthropic/DeepSeek-Rechnung hochtreiben
// würden.

import { timingSafeEqual } from 'node:crypto';

function tokensMatch(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function requireApiToken(req, res, next) {
  const expected = process.env.API_ACCESS_TOKEN;
  if (!expected) return next();

  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token || !tokensMatch(token, expected)) {
    return res.status(401).json({ error: 'missing or invalid API token' });
  }
  next();
}
