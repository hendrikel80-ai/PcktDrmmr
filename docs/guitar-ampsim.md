# Gitarre live via eigenem Amp-Simulator (Web Audio Nodes)

Aktive Implementierung des Gitarren-Signalwegs, siehe
`src/audio/GuitarEngine.js`. Ersetzt die frühere NAM-Integration
(`docs/nam-guitar.md`, jetzt zurückgestellt) als aktiven Signalweg im
Browser.

## Warum weg von NAM

NAM (Neural Amp Modeler) rendert per neuronalem Netz in WASM — das hat sich
als unvermeidbarer Latenz-Faktor herausgestellt:

- Selbst mit sehr guter Interface-Latenz (7.5 ms) kam spürbare zusätzliche
  Verzögerung dazu, sobald ein Modell aktiv war — reine Rechenzeit der
  Inferenz pro 128-Sample-Block, kein Routing-Problem.
- Kein SIMD-Umschalter im verwendeten `neural-amp-modeler-wasm`-Paket, kein
  Weg, die Rechenzeit im Browser zu senken.
- Der Umweg über ein natives ASIO-Plugin (statt Browser) scheiterte an
  kaputten Windows-Release-Downloads (leere GitHub-Assets bei den
  aktuellen Versionen) und veralteten Modell-Format-Versionen in den
  verfügbaren Builds.

Details und die komplette Latenz-Diagnose: `docs/nam-guitar.md` (Datei
bleibt als Referenz erhalten, NAM-Code ist weiterhin in
`GuitarEngine.js` vorhanden, aber nicht mehr in die aktive Kette
eingebunden — siehe "NAM als spätere Option" unten).

## Signalkette

```
Gitarre/Interface (getUserMedia)
  -> Input-Gain
  -> WaveShaperNode (Sättigung/Verzerrung, feste tanh-Kurve —
     die Stärke der Verzerrung folgt dem Pegel, den Input-Gain davor
     reinschiebt, wie bei einem echten Amp)
  -> 3-Band-Klangregelung (Bass/Mid/Treble, BiquadFilterNodes)
  -> Reverb (ConvolverNode mit prozedural erzeugter kurzer
     Raum-Impulsantwort, per Wet-Anteil zumischbar)
  -> Output-Gain
  -> gemeinsamer Master-Bus (auch die Drums laufen hier zusammen)
```

Läuft komplett auf nativen Web-Audio-Nodes direkt auf dem Audio-Thread —
keine WASM-/Neural-Net-Inferenz, also keine zusätzliche Rechen-Latenz
obendrauf. Übrige Latenz ist reine Browser-/Windows-Audio-Pipeline
(WASAPI), siehe `docs/nam-guitar.md` für die Systemboden-Diagnose (~60 ms
auf diesem Rechner, browserübergreifend bestätigt).

## Regler

- **Gain** (0–8, Default 1): Pegel vor der Verzerrungsstufe. Höher = mehr
  Sättigung/Verzerrung.
- **Bass / Middle / Treble** (je -12 bis +12 dB, Default 0): klassischer
  3-Band-Tonestack nach der Verzerrung.
- **Reverb** (0–1, Default 0.15): Wet-Anteil des Raumhalls, additiv zum
  immer vollen Dry-Signal (kein Equal-Power-Crossfade — einfacher
  Send-Regler wie an den meisten Reverb-Pedalen).
- **Output** (0–2, Default 1): Gesamtlautstärke im Mix mit den Drums.

## Reverb-Impulsantwort

Statt eines heruntergeladenen Impulse-Response-Samples (Lizenzfrage,
externe Abhängigkeit) erzeugt `createRoomImpulse()` in `GuitarEngine.js`
die Impulsantwort prozedural zur Laufzeit (exponentiell abklingendes
Rauschen, ~1.2 s). Klingt dezenter/kürzer als ein echtes Hall-Sample,
dafür lizenzfrei und ohne Asset-Ladezeit.

## NAM als spätere Option (Tauri-Desktop) — inzwischen umgesetzt

Laut CLAUDE.md bewusst zurückgestellt, nicht verworfen — und seitdem
tatsächlich umgesetzt: der native Tauri/ASIO-Gitarrenpfad (`src-tauri/`,
siehe `docs/nam-guitar.md`) läuft mit echter NAM-Inferenz ohne den hier
beschriebenen Browser-WASM-Kompromiss. Der Browser-Pfad in
`GuitarEngine.js` bleibt unverändert der klassische Web-Audio-Amp-Sim
ohne NAM, für den Fall, dass Pocket Studio mal ohne den Tauri-Shell
(z. B. reiner `npm run dev`) genutzt wird.

Die frühere lokale Amp-Bibliothek (IndexedDB, `AmpLibrary.jsx`) ist
inzwischen entfernt statt reaktiviert — der native Pfad lädt `.nam`-Dateien
direkt vom Dateisystem, eine zusätzliche Browser-Speicherung ist überflüssig.
Der KI-Amp-Finder lebt als "Sound Like"-Feature weiter, siehe
`docs/sound-like.md`.
