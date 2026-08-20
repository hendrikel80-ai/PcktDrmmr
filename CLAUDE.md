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

## Aufgabe: Realistischerer Drum-Sound

Ziel: weg vom "Drum-Machine"-Klang, hin zu "klingt wie echt gespieltes
Schlagzeug". Größte Hebel, in Prioritätsreihenfolge:

1. **Velocity-Layer statt reiner Gain-Skalierung**
   - Pro Instrument 3–4 Samples bei unterschiedlicher Anschlagstärke
     aufgenommen/bezogen (leise/mittel/laut), nicht nur ein Sample lauter
     abgespielt.
   - Beim Playback anhand des Velocity-Werts (0–127) das passende
     Sample-Layer auswählen, nicht nur die Lautstärke skalieren – sonst
     bleibt das Timbre unnatürlich gleich.

2. **Round-Robin**
   - 2–3 Varianten pro Velocity-Layer, reihum abwechselnd abspielen, damit
     nicht jeder Hit identisch klingt.

3. **Timing-Humanize verfeinern**
   - Kleine zufällige Timing-Abweichung pro Hit (ca. ±5–15 ms), nicht
     gleichmäßig verteilt.
   - Sollte an bestehendes `humanize`-Flag im Pattern-Schema andocken.

4. **Hihat-Choking**
   - Wenn nach einem offenen Hihat-Hit ein geschlossener folgt (oder ein
     expliziter Choke-Event), muss der offene Sample-Playback abrupt
     gestoppt werden (kurzer Fade-out), wie beim Fußpedal-Dämpfen am
     echten Kit.

5. **Drumbus-Verarbeitung**
   - Dezenter kurzer Room-Reverb auf dem Summen-Bus (kein langer Hall).
   - Leichte Kompression auf dem Drumbus für mehr Druck/Zusammenhalt.

**Sample-Kit-Empfehlung:** gutes Multisample-Kit mit Velocity-Layern
suchen, z. B. MT Power Drum Kit (kostenlos, GM-Mapping, realistisch) statt
Einzel-One-Shot-Samples.

**Technische Notiz Web Audio API:** Velocity-Layer-Auswahl und Round-Robin
lassen sich einfach in der Sample-Loading-/Playback-Schicht (Aufgabe 3 aus
"Erste Aufgaben") mit einbauen – am besten dort ansetzen, bevor die
UI-Anbindung folgt.

## Aufgabe: Gitarre live einspielen via NAM (Neural Amp Modeler)

Ziel: Gitarre (über Focusrite Scarlett) live mit Amp-Modeling durch den
Browser schicken, parallel zum laufenden Drum-Sequencer im selben
Audio-Graph.

1. **Input-Zugriff:** Scarlett-Interface über `getUserMedia`/`AudioContext`
   als Audioquelle einbinden (Nutzer wählt Interface im Browser-Dialog).
2. **NAM-Integration:** Bestehendes Open-Source-Package nutzen statt
   selbst zu bauen – `neural-amp-modeler-wasm`
   (github.com/tone-3000/neural-amp-modeler-wasm, MIT-lizenziert,
   basiert auf NeuralAmpModelerCore).
   - WASM-Dateien im `public/`-Verzeichnis hosten
   - Läuft in eigenem `AudioWorkletProcessor` (eigener Audio-Thread,
     kein Blocking des Main-Threads)
3. **Signalkette:** Gitarre (getUserMedia) → Input Gain → NAM
   AudioWorklet (Amp-Modell-Inferenz) → optional ConvolverNode
   (Cabinet-IR) → Output Gain → gemeinsamer Ausgang mit Drum-Sequencer
4. **Modell-Auswahl:** `.nam`-Modelldateien von tone3000.com o.ä. laden
   (Lizenz der jeweiligen Modelle prüfen, viele sind Community/frei).
5. **Latenz-Hinweis:** Browser-Audio hat inhärent etwas mehr Latenz als
   native ASIO/CoreAudio-Setups. Für "zum Beat mitspielen" unkritisch,
   nicht für sample-genaues Recording-Timing.

## Aufgabe: Riff-Aufnahme (lokal speichern)

Ziel: Gitarre (via NAM) + Drum-Sequencer gemeinsam aufnehmen und als
Audiodatei lokal auf dem Rechner speichern. **Kein OneDrive/Cloud-Upload
in dieser Phase** – rein lokaler Download.

1. **Mixdown-Bus:** Beide Signalquellen (NAM-Output + Drum-Sequencer-
   Output) auf einen gemeinsamen `MediaStreamAudioDestinationNode` routen.
2. **Aufnahme:** `MediaRecorder`-API auf diesem Stream aufzeichnen
   (Start/Stop über UI-Button, z. B. gekoppelt an Sequencer Play/Stop).
3. **Format:** Browser liefert i. d. R. WebM/Opus – für WAV-Export
   ggf. Konvertierung nötig (z. B. via eigener Encoding-Routine oder
   Library), falls WAV gewünscht ist.
4. **Download:** Aufgenommenen Blob als Download-Link anbieten
   (`URL.createObjectURL` + `<a download>`), Dateiname z. B. mit
   Timestamp/Pattern-Name.
5. **Später (nicht jetzt):** OneDrive-Anbindung als eigenständiger
   Ausbauschritt – erfordert Microsoft-OAuth (Azure App-Registrierung)
   und Upload über Microsoft Graph API. Bewusst zurückgestellt, bis
   lokale Aufnahme sauber läuft.

## Offene Entscheidungen

- Sample-Quelle: eigene Aufnahmen vs. lizenzfreie Sample-Packs (z. B.
  von freesound.org, Lizenz prüfen)
- Persistenz: erstmal nur In-Memory/localStorage, oder direkt eine
  einfache DB für gespeicherte Patterns?
- Deployment-Ziel: lokal fürs eigene Üben reicht erstmal, später
  ggf. hosten?
