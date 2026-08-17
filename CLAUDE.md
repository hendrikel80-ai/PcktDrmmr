# Drum Computer App – Projektkontext

## Ziel

Eine Web-App, mit der man (Gitarrist/Bassist) realistische Drum-Beats zum
Mitspielen bekommt. Zwei Wege, Beats zu erzeugen:

1. **Step-Sequencer** – klassisches manuelles Programmieren von Patterns.
2. **KI-Generierung** – per Text-Prompt einen Beat vorschlagen lassen, z. B.:
   - "Punk Beat 4/4 160 BPM"
   - "Erstelle mir einen Drumbeat im Stile von [Song/Künstler]"
     (→ wird stilistisch interpretiert, kein 1:1-Nachbau realer Patterns,
     siehe Regeln im Prompt unten)

Referenz-Tools am Markt: Drumloop AI, Soundful, Artificial Studio – nutzen
Neural-Audio-Synthese. Unser Ansatz ist einfacher und bewusst anders:
**LLM generiert ein strukturiertes JSON-Pattern, kein Audio-Rendering.**
Playback erfolgt über echte, lizenzfreie Drum-Samples via Web Audio API.
Das ist deutlich leichter umzusetzen und reicht für den Use Case
(Übungsbegleitung) völlig aus.

## Tech-Stack (Vorschlag, anpassbar)

- **Frontend:** React + Vite
- **Audio:** Web Audio API (Sample-Playback, präzises Timing via
  AudioContext-Scheduling, nicht `setTimeout`)
- **Samples:** kuratiertes Set lizenzfreier Drum-Samples (Kick, Snare,
  Hihat closed/open, Crash, Ride, Toms)
- **Backend:** Node/Express-Route als Proxy zur Claude API (API-Key darf
  nicht im Frontend landen)
- **KI:** Anthropic API (`claude-sonnet-4-6`), liefert Pattern als JSON

## Datenmodell: Drum-Pattern-Schema

16 Steps pro Takt, Velocity-Werte 0–127 statt reinem An/Aus (für
Ghost Notes / Akzente / weniger mechanischen Groove):

```json
{
  "bpm": 160,
  "time_signature": "4/4",
  "bars": 1,
  "style_description": "kurze Beschreibung des Stils",
  "pattern": {
    "kick":         [110,0,0,0, 0,0,90,0, 0,0,0,0, 110,0,0,0],
    "snare":        [0,0,0,0, 100,0,0,0, 0,0,0,0, 105,0,0,0],
    "hihat_closed": [80,60,80,60, 80,60,80,60, 80,60,80,60, 80,60,80,60]
  },
  "humanize": true
}
```

Erlaubte Instrument-Keys: `kick`, `snare`, `hihat_closed`, `hihat_open`,
`crash`, `ride`, `tom_low`, `tom_mid`, `tom_high`.

Vollständiges JSON-Schema inkl. Validierungsregeln: siehe
`docs/drum-pattern-schema.md` (aus vorherigem Chat, bitte mit ins Repo legen).

## System-Prompt für die KI-Generierung

```
Du bist ein Drum-Pattern-Generator für einen Step-Sequencer mit 16 Steps
pro Takt. Du erhältst eine Nutzeranfrage (Genre, Tempo, Taktart, oder
Stilbeschreibung) und gibst NUR gültiges JSON zurück – kein Fließtext,
keine Markdown-Codeblöcke.

Schema: [siehe oben]

Regeln:
- Bei Songanfragen: KEIN 1:1-Nachbau realer Patterns. Übersetze in
  Stilmerkmale (Genre, Tempo-Range, typische Drum-Elemente) und generiere
  ein eigenständiges Pattern im Stil.
- Nutze variierende Velocity-Werte statt nur An/Aus für einen
  musikalischeren Groove.
- Baue dezente Ghost Notes und kleine Fills ein, v.a. am Ende von
  Mehrtakt-Patterns.
- Bei fehlender BPM-Angabe: wähle einen genretypischen Wert.
```

## Erste Aufgaben (Reihenfolge)

1. **Projekt-Setup:** Vite + React Grundgerüst, Ordnerstruktur
2. **Audio-Engine:** AudioContext-Scheduler, der ein Pattern-Objekt
   (siehe Schema) präzise abspielt (lookahead-Scheduling, kein
   `setInterval`-Jitter)
3. **Sample-Loading:** ein erstes Drum-Kit (5–7 Samples) einbinden
4. **Manueller Step-Sequencer:** UI zum Klicken von Steps pro Instrument,
   spielt das oben stehende Beispiel-Pattern ab
5. **KI-Route:** Backend-Endpoint `/api/generate-pattern`, nimmt
   Text-Prompt entgegen, ruft Claude API mit System-Prompt auf, validiert
   JSON gegen Schema, gibt Pattern zurück
6. **UI-Anbindung:** Text-Input im Frontend → Backend-Call → Pattern lädt
   automatisch in den Sequencer
7. **Politur:** BPM-Regler, Play/Stop, Pattern-Speichern/Laden

## Offene Entscheidungen

- Sample-Quelle: eigene Aufnahmen vs. lizenzfreie Sample-Packs (z. B.
  von freesound.org, Lizenz prüfen)
- Persistenz: erstmal nur In-Memory/localStorage, oder direkt eine
  einfache DB für gespeicherte Patterns?
- Deployment-Ziel: lokal fürs eigene Üben reicht erstmal, später
  ggf. hosten?
