# Pocket Studio – Projektkontext

## Status (Stand: 2026-09-14)

Die App ist inzwischen weit über die ursprüngliche Browser-Only-Planung
unten hinausgewachsen (die "Erste Aufgaben"/"Aufgabe: ..."-Abschnitte
unterhalb sind der ursprüngliche Projekt-Auftrag und größtenteils als
historischer Kontext stehen gelassen, nicht als aktueller Stand).

### Fertig implementiert

- **Sequencer & Patterns**: 16-Step-Sequencer mit Velocity (Off/Ghost/
  Normal/Accent), lookahead-präzises Scheduling (`Scheduler.js`),
  Pattern-Speichern/Laden, MIDI-Export.
- **KI-Beat-Generierung**: Text-Prompt → Pattern-JSON über austauschbaren
  Provider (Anthropic/DeepSeek, `server/aiProvider.js`), lokaler Cache für
  Anfragen, nutzt gespeicherte Patterns als Referenz für mehr Vielfalt.
  Sitzt jetzt direkt in der Drums-Sektion.
- **Drum-Kits**: mehrere echte Sample-Kits (u. a. `pearl-acoustic` als
  einziges mit voller Instrument-Abdeckung) + Synth-Fallback für Lücken,
  Velocity-Layer, Round-Robin, Hihat-Choking.
- **Desktop-App (Tauri + natives Rust/ASIO-Backend, `src-tauri/`)**:
  - Gitarre/Mikro live über ASIO (Focusrite Scarlett), echter NAM-
    Amp-Modeler nativ eingebunden (kein Browser-Latenz-Nachteil mehr),
    Stimmgerät, zweiter Mic-Kanal (Vocals).
  - **Native Drum-Engine** (`src-tauri/src/drum_engine.rs`): rendert Drums
    ausschließlich in den Aufnahme-Tap, im selben ASIO-Callback wie
    Gitarre/Mikro — macht Drift zwischen Drums und Gitarre in Aufnahmen
    strukturell unmöglich (war zuvor ein reales Problem: zwei unabhängige
    Uhren, Browser-Drums vs. native Aufnahme). Kompensiert zusätzlich die
    Browser-Monitoring-Latenz, damit der Start-Zeitpunkt exakt zum
    gehörten Beat passt.
  - **Aufnahmen-Liste**: zeigt nur noch den fertigen Mix (Drums+Gitarre/
    Mic+Vocals), direkt in der App abspielbar, Mülleimer löscht die Datei
    wirklich von der Festplatte.
  - **Sound Like**: KI recherchiert per Websuche zu einem Musiker/Band
    passendes Amp-Equipment, verlinkt pro Vorschlag zur TONE3000-Suche
    (öffnet im Systembrowser über `tauri-plugin-opener`).
  - **Start-Skripte** (`start-pocket-studio.{bat,ps1,vbs}` + Desktop-
    Verknüpfung): App startet komplett ohne sichtbare Konsolenfenster.
- **Mobile-App** (`?mobile`-URL-Parameter, `src/components/MobileApp.jsx`,
  `src/audio/useMobileAudioEngine.js`): schlanke, eigenständige Variante
  für Handy/Tablet im Browser (kein Tauri/ASIO nötig) — Drum-Sequencer +
  einfache Mikrofon-Aufnahme (kein Amp-Sim, nur Pegel), responsives
  Touch-Layout. Läuft im selben Vite-Projekt wie die Desktop-App, ohne sie
  zu berühren. **Aktuell noch nicht committet, noch nicht auf einem
  echten Gerät getestet.**

### Release-Prozess

Verteilung läuft über GitHub Releases, nicht über rohe Commits/Pushes —
ein `git push` auf `main` hat für Nutzer keinerlei Wirkung. Ablauf für
eine neue Version:

1. Version in `package.json` UND `src-tauri/tauri.conf.json` hochzählen
   (beide müssen übereinstimmen).
2. Neuen Abschnitt in `CHANGELOG.md` ergänzen (aus "Unveröffentlicht" wird
   z. B. "[0.2.0] - 2026-09-22").
3. Commit + Push wie gewohnt.
4. Tag setzen und pushen: `git tag v0.2.0 && git push origin v0.2.0`
   (Versionsnummer im Tag muss zu Schritt 1 passen).
5. GitHub Actions (`.github/workflows/release.yml`) baut den Windows-
   Installer automatisch und legt ihn als **Draft**-Release ab — für
   niemanden außer dir sichtbar.
6. Auf GitHub den Draft prüfen und erst dann manuell auf "Publish
   release" klicken — das ist der Moment, ab dem Freunde die neue Version
   herunterladen können. Bis dahin bleibt die vorherige Version die
   einzige öffentlich sichtbare.

Noch nicht getestet (kein Tag wurde bisher gepusht) — der erste echte
Release-Versuch ist der eigentliche Test der Pipeline.

### Bekannte offene Punkte

- **Produktions-Installer** (`cargo tauri build`) für die Desktop-App
  noch nicht erstellt — bisher nur Dev-Modus (`cargo tauri dev --release`).
  Nötig, um die App an Freunde weiterzugeben.
- **KI-Backend-Hosting für Freunde/Mobile** bewusst zurückgestellt: der
  Anthropic/DeepSeek-API-Key liegt nur lokal in `.env`, ein gehostetes
  Backend (mit Nutzungslimit) wäre nötig, damit "Generate a Beat"/
  "Sound Like" auch außerhalb des eigenen Rechners funktionieren.
- **HTTPS für Mobile-Mikrofonzugriff im Heimnetz** noch nicht eingerichtet
  — `getUserMedia` verlangt einen sicheren Kontext, ein einfacher
  Tunnel-Dienst (z. B. Tailscale Funnel) wäre der schnellste Weg.
- **Code-Signing** für einen künftigen Installer fehlt — Windows würde bei
  Freunden eine SmartScreen-Warnung zeigen.
- **Steinberg ASIO SDK-Lizenz ungeklärt**: `asio-sys`/`cpal` laden die SDK
  beim Build direkt von steinberg.net und kompilieren sie mit ein. Steinberg
  verlangt für jedes Produkt, das gegen die SDK gebaut wird, entweder
  GPLv3-Lizenzierung des eigenen Produkts oder eine unterschriebene (aber
  kostenlose) "Proprietary ASIO SDK License Agreement" — noch nicht
  eingeholt. Details siehe LICENSE-Datei im Repo-Root. Vor jeder Weitergabe
  über den engsten persönlichen Kreis hinaus zu klären.
- **Release-Workflow (`.github/workflows/release.yml`) noch nicht getestet**
  — zurückgestellt (siehe "Release-Prozess" oben). Erster Test: einen
  harmlosen Tag wie `v0.1.1-test` pushen und die Actions-Logs auf GitHub
  prüfen, bevor die erste echte Version darüber ausgeliefert wird.

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

## Aufgabe: Gitarre live einspielen via eigenem Amp-Simulator (Web Audio Nodes)

**Hintergrund:** NAM (WASM-Inferenz) hat sich als spürbarer Latenz-Faktor
im Browser herausgestellt (Interface-Latenz war mit 7.5ms bereits gut,
Verzögerung kam aus der neuronalen Netz-Verarbeitung pro Audio-Block).
Statt NAM daher ein eigener, klassischer Amp-Simulator rein aus nativen
Web Audio Nodes – läuft direkt auf dem Audio-Thread ohne zusätzliche
Inferenz-Latenz, quasi wie Passthrough mit Klangfärbung.

Ziel: Gitarre (über Focusrite Scarlett) live mit eigenem Amp-Modell
(Gain, Treble, Middle, Bass, Reverb) durch den Browser schicken, parallel
zum laufenden Drum-Sequencer im selben Audio-Graph.

1. **Input-Zugriff:** Scarlett-Interface über `getUserMedia`/`AudioContext`
   als Audioquelle einbinden (Nutzer wählt Interface im Browser-Dialog).
2. **Signalkette (alles native Web Audio Nodes, kein WASM/Neural Net):**
   ```
   Input (Scarlett)
     → WaveShaperNode (Gain/Distortion, Sättigungskurve z.B. tanh-basiert)
     → BiquadFilterNode "lowshelf" (Bass, ~100-150Hz)
     → BiquadFilterNode "peaking" (Middle, ~800Hz-1kHz, Q einstellbar)
     → BiquadFilterNode "highshelf" (Treble, ~3-5kHz)
     → ConvolverNode (Reverb, kurze Room-IR) oder einfacher
       DelayNode-Feedback-Reverb als Alternative
     → Output Gain
     → gemeinsamer Ausgang mit Drum-Sequencer
   ```
3. **Regler-Mapping:** Jeder UI-Regler (Gain/Treble/Middle/Bass/Reverb)
   steuert live den entsprechenden `.gain`/Parameter-Wert des jeweiligen
   Nodes.
4. **Reverb-IR-Quelle:** kostenlose Impulse-Responses z.B. von OpenAIR,
   Lizenz prüfen.
5. **Bekannter Trade-off:** klingt wie ein solider klassischer Amp-Sim,
   nicht wie ein durch KI gelerntes Abbild eines echten Röhrenamps (das
   war NAMs Stärke). Für Latenzfreiheit/Spielbarkeit bewusst in Kauf
   genommen.

**Zurückgestellt, nicht verworfen – NAM als spätere Option:** Falls das
Projekt später auf eine native Desktop-App umgebaut wird (z.B. Tauri +
`cpal` für ASIO-Zugriff), könnte NAM dort ohne Browser-Latenz-Nachteil
nachgerüstet werden. Bewusst zurückgestellt, kein aktueller Fokus.

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

## Aufgabe: Beat-Library mit Generator-Agent (gegen Eintönigkeit)

**Hintergrund:** Live-generierte Patterns pro Anfrage wirken zu eintönig
(LLM fällt bei isolierten Einzelanfragen leicht in ähnliche Muster).
Lösung: eine vorab kuratierte, nach Genre/Subgenre geordnete Library
von Patterns, aus der der Sequencer bevorzugt bedient statt bei jeder
Anfrage live und unabhängig zu generieren.

**Ordnerstruktur (nutzt bestehendes JSON-Pattern-Schema):**
```
library/
  punk/
    street-punk/
      beat_001.json
      beat_002.json
    skate-punk/
    pop-punk/
    hardcore/
  metal/
    thrash/
    doom/
    metalcore/
  funk/
  reggae/
  rock/
    classic-rock/
    indie-rock/
```

**Metadaten pro Pattern-Datei (Erweiterung des bestehenden Schemas):**
```json
{
  "genre": "punk",
  "subgenre": "street-punk",
  "tags": ["driving", "syncopated-kick", "with-fill"],
  "bpm": 160,
  "time_signature": "4/4",
  "bars": 1,
  "style_description": "...",
  "pattern": { ... },
  "humanize": true
}
```

**Generator-Agent (Batch-Skript, einmalig/wiederholt ausführbar):**
1. Nimmt eine Genre/Subgenre-Taxonomie als Vorgabe (siehe Beispiel unten,
   erweiterbar)
2. Ruft pro Subgenre mehrfach die Claude API auf, mit variierenden
   Zusatz-Anweisungen (z. B. "Fokus auf treibende Achtel", "mit
   synkopiertem Kick", "mit Fill alle 4 Takte", "halftime-Feel"), damit
   sich die Ergebnisse innerhalb eines Subgenres unterscheiden
3. Speichert jedes Ergebnis als JSON nach obigem Schema/Ordnerstruktur
4. **Ähnlichkeits-Check:** einfache Distanz-Berechnung zwischen den
   generierten Step-Arrays (z. B. Hamming-Distanz auf den Velocity-
   Arrays), um Near-Duplikate zu erkennen und zu verwerfen/neu zu
   generieren

**Beispiel-Taxonomie zum Start (erweiterbar):**
- Punk: Street Punk, Skate Punk, Pop-Punk, Hardcore
- Metal: Thrash, Doom, Metalcore
- Rock: Classic Rock, Indie Rock
- Funk
- Reggae

**Sequencer-Anbindung:**
- Nutzer-Prompt (z. B. "Punk Beat 160 BPM") wird primär als Filter/Suche
  in der Library interpretiert (Genre + Subgenre-Erkennung + BPM-Bereich
  + ggf. Tags), nicht mehr zwangsläufig als Live-Generierungs-Auftrag
- Live-API-Generierung bleibt als Fallback für Anfragen, die die Library
  nicht abdeckt
- **Qualitäts-Feedback-Loop (später):** kuratierte Library-Patterns
  können als Few-Shot-Beispiele in den Live-Generierungs-Prompt
  zurückgespeist werden, um auch spontane Anfragen zu verbessern

**Aufwand-Hinweis:** Der Agent selbst ist ein überschaubares Batch-
Skript. Der eigentliche Aufwand liegt in der Taxonomie-Pflege und darin,
pro Subgenre genug variantenreiche Patterns zu generieren, bis sich die
Library wirklich vielfältig anfühlt – eher Kuratier- als
Programmieraufwand.

## Offene Entscheidungen

- Sample-Quelle: eigene Aufnahmen vs. lizenzfreie Sample-Packs (z. B.
  von freesound.org, Lizenz prüfen)
- Persistenz: erstmal nur In-Memory/localStorage, oder direkt eine
  einfache DB für gespeicherte Patterns?
- Deployment-Ziel: lokal fürs eigene Üben reicht erstmal, später
  ggf. hosten?
