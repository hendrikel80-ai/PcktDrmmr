# Amp-Bibliothek & KI-Empfehlung

Ergänzt die NAM-Gitarren-Integration (`docs/nam-guitar.md`) um eine lokale
Verwaltung für Amp-Modelle und Cabinet-IRs, plus eine KI-gestützte
Empfehlungsfunktion.

## Warum keine automatisierte TONE3000-Suche

TONE3000s Nutzungsbedingungen verbieten explizit automatisiertes
Herunterladen/Scrapen:

> "You may not use automated tools, scripts, bots, or other means to
> systematically download, scrape, or extract... content from our platform."
> / "You may not use any means to access our service in a way that exceeds
> normal human browsing patterns."

Eine fest in die App eingebaute Pipeline, die bei jedem Nutzer-Prompt
automatisch gegen TONE3000 sucht/lädt, würde das verletzen. Stattdessen:

1. **KI-Empfehlung** (`server/suggestAmps.js`, `AmpFinder.jsx`): Claude
   schlägt anhand von öffentlich bekanntem Equipment-Wissen (welches Gear
   für welchen Sound/welche Band typisch ist) reale Verstärkermodelle vor —
   keine Live-Suche, reines Modellwissen — plus einen direkten Such-Link zu
   `tone3000.com/search?...`.
2. **Manuelles Laden**: Der Nutzer klickt selbst durch zu TONE3000 und lädt
   die `.nam`/IR-Datei herunter (normales menschliches Browsing, ToS-konform).
3. **Lokale Bibliothek** (`src/data/ampLibrary.js`, `AmpLibrary.jsx`): Über
   den Datei-Picker in `GuitarPanel` geladene Modelle/IRs können mit einem
   eigenen Namen in einer lokalen IndexedDB-Bibliothek gespeichert und
   jederzeit direkt (ohne erneuten Datei-Dialog) wieder geladen werden.

## Speicherung

IndexedDB-Datenbank `pocket-drummer-amps` mit zwei Object Stores:
- `models`: `.nam`-Dateiinhalt als Text (NAM-Dateien sind JSON)
- `irs`: Cabinet-IR als `ArrayBuffer` (wird beim Laden via
  `decodeAudioData` dekodiert)

Beides bleibt rein lokal im Browser (IndexedDB), kein Server-Storage.

## Lizenzhinweis für heruntergeladene Amp-Modelle

TONE3000-Downloads unterliegen meist der "T3K"-Lizenz: private/kommerzielle
Nutzung der Audiodaten erlaubt, aber keine Weiterverbreitung der Rohdatei
selbst. Für die lokale Bibliothek (nur auf deinem Rechner, kein Sync/Upload)
ist das unproblematisch — nicht aber, falls du `.nam`-Dateien ins
Pocket-Drummer-Repo committen würdest (`amps/` ist deshalb in `.gitignore`).
