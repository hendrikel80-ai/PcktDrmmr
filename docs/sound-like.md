# Sound Like

Gitarist/Bassist oder Band eingeben ("James Hetfield", "Eric Clapton",
"Metallica") → Claude recherchiert reales Amp-Equipment und schlägt
`.nam`-Modelle vor, die man selbst auf TONE3000 herunterladen und über
"🎛 NAM-Modell laden" in den nativen Gitarrenpfad (`docs/nam-guitar.md`)
laden kann.

Frühere Vorstufe (`AmpFinder.jsx`/`suggestAmps.js`, aus der Zeit vor dem
NAM-Rückbau) reiner Modellwissen-basiert, keine Websuche. Mit Sound Like
ersetzt: `SoundLike.jsx` + `server/soundLike.js` + `server/soundLikePrompt.js`.

## Warum keine automatisierte TONE3000-Suche/-Downloads

TONE3000s Nutzungsbedingungen verbieten explizit automatisiertes
Herunterladen/Scrapen:

> "You may not use automated tools, scripts, bots, or other means to
> systematically download, scrape, or extract... content from our platform."
> / "You may not use any means to access our service in a way that exceeds
> normal human browsing patterns."

Eine fest in die App eingebaute Pipeline, die automatisch gegen TONE3000
sucht oder lädt, würde das verletzen. Stattdessen:

1. **Recherche via Claudes Web-Search-Tool** (`server/soundLike.js`):
   serverseitiges `web_search_20250305`-Tool, damit Claude tatsächlich nach
   dem realen Equipment des genannten Musikers recherchiert (Interviews,
   Rig-Rundowns, Wikipedia) statt sich nur auf eingefrorenes Trainingswissen
   zu verlassen. Der System-Prompt (`server/soundLikePrompt.js`) weist Claude
   ausdrücklich an, dabei **nicht** tone3000.com selbst zu besuchen/durchsuchen
   — das bleibt in Schritt 2.
2. **Nur ein Suchlink, kein Download-Link**: jeder Vorschlag verlinkt auf
   `tone3000.com/search?...` mit einem kurzen Suchbegriff. Der Nutzer klickt
   selbst durch und lädt die Datei von Hand herunter (normales menschliches
   Browsing, ToS-konform) — die App lädt oder verarbeitet nichts von TONE3000
   automatisiert.
3. **Laden**: Die heruntergeladene `.nam`-Datei wird ganz normal über den
   bestehenden nativen Datei-Dialog ("🎛 NAM-Modell laden") geladen — siehe
   `docs/nam-guitar.md`.

Kostenhinweis: das Web-Search-Tool wird pro Suche über die Anthropic-API
abgerechnet (zusätzlich zu den normalen Token-Kosten). `max_uses: 3` in
`server/soundLike.js` begrenzt das pro Anfrage.

## Lizenzhinweis für heruntergeladene Amp-Modelle

TONE3000-Downloads unterliegen meist der "T3K"-Lizenz: private/kommerzielle
Nutzung der Audiodaten erlaubt, aber keine Weiterverbreitung der Rohdatei
selbst.
