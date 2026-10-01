// Handgerollter Fixed-Window-Rate-Limiter statt einer zusätzlichen
// Dependency (express-rate-limit o.ä.) — für die Größenordnung dieser App
// (Einzelnutzer + ein paar Freunde über einen Tunnel wie Tailscale Funnel,
// siehe CLAUDE.md) reicht ein simpler In-Memory-Zähler, gleiches Prinzip
// wie die dateibasierte Cache-"DB" in cache.js.
//
// Schützt vor allem gegen Kosten-Missbrauch der KI-Endpunkte, falls der
// Server mal öffentlich erreichbar ist (kein Auth-Ersatz — siehe auth.js
// dafür): ein einzelner Bot, der wahllos POSTet, kann so pro IP nicht mehr
// beliebig oft die Anthropic/DeepSeek-API anstoßen.

const buckets = new Map(); // ip -> { count, windowStart }

// Verhindert unbegrenztes Wachstum der Map, falls tatsächlich viele
// verschiedene IPs anfragen (genau der Fall, vor dem der Limiter schützen
// soll) — läuft nur gelegentlich, nicht bei jeder Anfrage.
function pruneStale(windowMs) {
  const cutoff = Date.now() - windowMs * 2;
  for (const [ip, bucket] of buckets) {
    if (bucket.windowStart < cutoff) buckets.delete(ip);
  }
}

export function rateLimit({ windowMs, max }) {
  return (req, res, next) => {
    const ip = req.ip;
    const now = Date.now();
    const bucket = buckets.get(ip);

    if (!bucket || now - bucket.windowStart >= windowMs) {
      if (Math.random() < 0.01) pruneStale(windowMs);
      buckets.set(ip, { count: 1, windowStart: now });
      return next();
    }

    if (bucket.count >= max) {
      const retryAfterSeconds = Math.ceil((bucket.windowStart + windowMs - now) / 1000);
      res.set('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({ error: `Too many requests — try again in ${retryAfterSeconds}s` });
    }

    bucket.count += 1;
    next();
  };
}
