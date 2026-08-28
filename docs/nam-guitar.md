# Gitarre live via NAM (Neural Amp Modeler)

> **Zurückgestellt** — NAM ist seit der Latenz-Diagnose weiter unten nicht
> mehr der aktive Gitarren-Signalweg im Browser (siehe
> `docs/guitar-ampsim.md` für den aktuellen Stand: ein klassischer
> Amp-Simulator aus nativen Web-Audio-Nodes, ohne die hier beschriebene
> Inferenz-Latenz). Dieses Dokument bleibt als Referenz und für eine
> mögliche spätere Reaktivierung (native Desktop-App via Tauri) erhalten;
> der NAM-Code selbst ist weiterhin in `GuitarEngine.js` vorhanden, aber
> nicht mehr in die aktive Kette eingebunden.

Signalkette (historisch, siehe `src/audio/GuitarEngine.js`):

```
Gitarre/Interface (getUserMedia)
  -> Input-Gain (Drive)
  -> NAM-AudioWorklet (Amp-Modell-Inferenz, eigener Audio-Thread)
  -> 3-Band-Klangregelung (Bass/Mid/Treble)
  -> optionaler ConvolverNode (Cabinet-IR)
  -> Output-Gain
  -> gemeinsamer Master-Bus (auch die Drums laufen hier zusammen)
```

Nutzt die Low-Level-Engine-API von
[neural-amp-modeler-wasm](https://github.com/tone-3000/neural-amp-modeler-wasm)
(`neural-amp-modeler-wasm/engine`, MIT-lizenziert) statt der fertigen
React-Player-Komponente, damit sich alles frei in unseren eigenen
Audio-Graphen einfügt.

## WASM-Assets

`nam-worklet.js` und `nam-engine.wasm` liegen unter `public/nam/` und werden
per `scripts/copy-nam-assets.mjs` (läuft als `postinstall`) aus
`node_modules/neural-amp-modeler-wasm/dist/engine/` kopiert. Nach einem
Versions-Update des Packages einmal `npm install` (oder das Skript direkt)
erneut laufen lassen.

## Setup

1. Audio-Interface (z. B. Focusrite Scarlett) anschließen, Gitarre an
   Instrumenten-Eingang.
2. In Pocket Drummer auf **"🎸 Gitarre verbinden"** klicken, Browser fragt
   nach Mikrofon-/Interface-Zugriff → erlauben.
3. Im Dropdown das richtige Interface auswählen (Labels werden erst nach
   erteilter Berechtigung angezeigt).
4. **Amp-Modell laden (.nam)**: eigene `.nam`-Datei auswählen, z. B. von
   [tone3000.com](https://www.tone3000.com/) heruntergeladen. Wir bündeln
   bewusst keine Modelle im Repo — Lizenzen variieren pro Modell (viele
   Community-Modelle sind frei, manche nicht; vor Nutzung prüfen).
5. Optional **Cabinet-IR laden (.wav)**: Lautsprecher-Impulsantwort für mehr
   Amp-Charakter.
6. **Gain/Bass/Middle/Treble/Output** nach Bedarf einstellen (siehe unten).

## Gain und Klangregelung

Ein `.nam`-Capture ist eine statische Momentaufnahme **einer festen**
Amp-Reglereinstellung — die Gain/Treble/Bass/Middle-Regler des
aufgenommenen Amps stecken im Modell fest und lassen sich nicht
nachträglich ändern. Klingt das geladene Modell zu clean/unverzerrt, liegt
das meist daran, dass der Signalpegel, der ins Modell reingeht, zu leise
ist — Verzerrung bei modellierten Amps ist wie bei echten Röhrenamps
pegelabhängig.

Die App bietet deshalb fünf Regler in der Gitarren-Sektion
(`src/audio/GuitarEngine.js`):

- **Gain** (0-8, Default 1): Pegel **vor** dem NAM-Modell. Höher = mehr
  Verzerrung, wie beim Reindrehen des Gain-Reglers an einem echten Amp.
  Bei cleanem Ergebnis zuerst hier hochdrehen.
- **Bass / Middle / Treble** (je -12 bis +12 dB, Default 0): klassische
  3-Band-Klangregelung **nach** dem Modell (Low-Shelf @150 Hz,
  Peaking @800 Hz, High-Shelf @3000 Hz) — wie der Tonestack eines echten
  Amps oder ein EQ-Pedal danach. Wirkt unabhängig vom geladenen Modell.
- **Output** (0-2, Default 1): Gesamtlautstärke der Gitarrenkette im
  gemeinsamen Mix mit den Drums.

## Latenz

Browser-Audio hat inhärent etwas mehr Latenz als native ASIO/CoreAudio-
Setups (Windows-Browser nutzen WASAPI, kein ASIO — das lässt sich aus dem
Browser heraus nicht umgehen). Für "zum Beat mitspielen" unkritisch, nicht
für sample-genaues Recording-Timing.

**Was die App bereits tut, um die Latenz zu minimieren:**

1. `AudioContext` mit `latencyHint: 'interactive'` — kleinstmöglicher
   Standard-Puffer statt der für Video/Streaming optimierten Default-Größe.
2. `getUserMedia`-Constraints deaktivieren `echoCancellation`,
   `noiseSuppression`, `autoGainControl` (Chromes WebRTC-Audiopipeline für
   diese Effekte kostet selbst Latenz und verändert den Klang) und bitten
   zusätzlich per `latency: { ideal: 0 }` um den kleinstmöglichen
   Eingangspuffer.
3. **⚡ Niedrige-Latenz-Checkbox** in der Gitarren-Sektion: gibt beim nächsten
   Modell-Laden `slimSize: 0` an die NAM-Engine weiter. Bei "slimmable"
   A2-Modellen wird dadurch das kleinere, schneller zu berechnende
   Submodell gewählt — weniger Rechenzeit pro Audio-Block senkt das Risiko
   von Aussetzern/Knacksern unter Last (fühlt sich wie zusätzliche Latenz
   an). Nicht-slimmable Modelle ignorieren die Option folgenlos.
4. **🔄 Latenz messen**-Anzeige: zeigt `baseLatency` (interner Web-Audio-
   Puffer) + `outputLatency` (Ausgabe-Hardware-Latenz) + — falls vom
   Browser gemeldet — `inputMs` (tatsächlich ausgehandelte Eingabe-
   Pufferlatenz laut `MediaStreamTrack.getSettings().latency`) in
   Millisekunden direkt in der UI (`GuitarEngine.getLatencyInfo()`). Chrome
   meldet `inputMs` oft nicht zuverlässig — dann ist die Summe nur ein
   Teilbild (mit "+" markiert), die reale Round-Trip-Latenz liegt noch
   etwas höher.

**Realistische Erwartungshaltung:** Das analoge Hardware-Direct-Monitoring
eines Interfaces (Signal geht rein und sofort wieder raus, ganz ohne
Computer/Software) liegt oft im 1-stelligen ms-Bereich — das erreicht keine
Software, auch keine ASIO-DAW, weil dort immer mindestens ein Puffer-
Roundtrip durch den Treiber dazukommt. Ein realistisches Ziel über Browser-
Audio ist eher **10-25 ms**, vergleichbar mit einer ASIO-DAW bei kleinem
Puffer — nicht die Hardware-Zahl.

**Wenn `outputLatency` deutlich höher ausfällt** (z. B. 50-70 ms statt
~10-20 ms): das liegt fast immer an der Windows-Audio-Pipeline zwischen
Browser und Interface, nicht am Code hier. In der Reihenfolge der
Wahrscheinlichkeit:

1. **Focusrite Control → Puffergröße.** Auch wenn ASIO/Direct Monitoring
   separat läuft, beeinflusst diese Einstellung oft auch den WASAPI-Pfad,
   den der Browser nutzt. Möglichst klein stellen (z. B. 64-128 Samples)
   und testen, ob sich die von der App gemessene Latenz ändert.
2. **Windows-Sound-Systemsteuerung → Scarlett-Gerät → Eigenschaften →
   Erweitert:**
   - "Standardformat" prüfen — sollte zur Samplerate passen, die die App
     unter "@ ... Hz" anzeigt (i. d. R. 44100 oder 48000 Hz). Bei
     Nichtübereinstimmung resampelt Windows intern, was zusätzliche Latenz
     kostet.
   - Falls vorhanden: "Anwendungen exklusiven Zugriff auf dieses Gerät
     erlauben" aktivieren.
3. **Wiedergabe-/Aufnahme-Eigenschaften → Tab "Verbesserungen"/
   "Erweiterungen":** alle Audio-Enhancements deaktivieren (kosten
   zusätzliche Verarbeitung/Latenz im Windows-Audiograph).
4. Andere Programme schließen, die auf dasselbe Interface zugreifen
   (Zoom, Discord, andere DAWs im Hintergrund) — sie können Windows in den
   höher-latenten Shared-Mode zwingen.
5. Chrome-Neustart nach Änderungen an 2./3. — Windows-Audio-Endpoints
   werden teils erst bei neuem Prozess neu verhandelt.

Diese vier Punkte sind alle außerhalb dessen, was Code im Browser
beeinflussen kann — Web Audio hat keinen Zugriff auf ASIO oder die
Windows-Audio-Engine-Konfiguration.

### Zusätzliche Latenz, sobald das Amp-Modell aktiv ist

Wenn sich die Latenz *nur* verschlechtert, sobald ein `.nam`-Modell geladen
ist (clean/bypass fühlt sich dagegen gut an), ist das **kein Routing-
Problem, sondern reine Rechenzeit** der Modell-Inferenz auf dem Audio-
Thread. Geprüft und ausgeschlossen (Stand `neural-amp-modeler-wasm`
2.0.1, siehe `node_modules/neural-amp-modeler-wasm/dist/engine/`):

- **Kein Resampling-Bug**: `expectedSampleRate` (Trainings-Sample-Rate des
  Modells) wird nur informativ gemeldet, nie mit der tatsächlichen
  `AudioContext`-Sample-Rate verglichen oder ausgeglichen.
- **Kein SIMD-Umschalter**: Es gibt nur eine einzige vorkompilierte
  `nam-engine.wasm`, keine SIMD-Variante zum Aktivieren.
- **Render-Quantum ist fix**: 128 Samples pro Block, von der Web-Audio-
  Spec vorgegeben — Puffergrößen-Einstellungen ändern daran nichts.

Es bleibt also echte, nicht wegoptimierbare Inferenzzeit pro Block. Die
einzigen wirksamen Hebel:

1. **"⚡ Niedrige Latenz"-Checkbox** — hilft nur bei "slimmable" Modellen
   (z. B. A2-Architektur). Die App zeigt jetzt direkt am Modell an, ob es
   das unterstützt (`modelInfo.slimmable`); bei nicht-slimmable Modellen
   ist die Checkbox deaktiviert, weil sie wirkungslos wäre.
2. **Leichteres Modell wählen** — manche Packs bieten "Lite"/"Feather"-
   Varianten mit kleinerer Netzarchitektur, die pro Block schneller
   rechnet.
3. **CPU-Last reduzieren** — andere Programme/Tabs schließen, damit der
   Audio-Thread seinen 128-Sample-Zeitrahmen zuverlässiger einhält.

## Modell-Wechsel während der Wiedergabe

`loadModel()` pausiert das Rendering an diesem Node kurz (laut Engine-Doku
typischerweise 100–300 ms) und blendet danach klickfrei wieder ein — der
Drum-Sequencer läuft währenddessen unbeeinflusst weiter, da beide
unabhängige Zweige im selben Audio-Graph sind.
