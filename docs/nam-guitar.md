# Gitarre live via NAM (Neural Amp Modeler)

Signalkette (siehe `src/audio/GuitarEngine.js`):

```
Gitarre/Interface (getUserMedia)
  -> Input-Gain
  -> NAM-AudioWorklet (Amp-Modell-Inferenz, eigener Audio-Thread)
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
6. Input-/Output-Gain nach Bedarf einstellen.

## Latenz

Browser-Audio hat inhärent etwas mehr Latenz als native ASIO/CoreAudio-
Setups. Für "zum Beat mitspielen" unkritisch, nicht für sample-genaues
Recording-Timing. Der AudioContext wird mit `latencyHint: 'interactive'`
erzeugt, um möglichst kurze Puffer zu bekommen.

## Modell-Wechsel während der Wiedergabe

`loadModel()` pausiert das Rendering an diesem Node kurz (laut Engine-Doku
typischerweise 100–300 ms) und blendet danach klickfrei wieder ein — der
Drum-Sequencer läuft währenddessen unbeeinflusst weiter, da beide
unabhängige Zweige im selben Audio-Graph sind.
