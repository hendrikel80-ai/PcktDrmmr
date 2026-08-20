# Echte Sample-Kits einbinden

Standard/Heavy Metal/Punk/Country laufen weiterhin komplett über die
synthetische Audio-Engine (`src/audio/DrumSynth.js`) — u. a. weil die
Lizenzfrage für Fremd-Sample-Packs wie MT Power Drum Kit ungeklärt bleibt
(siehe `CLAUDE.md`, Abschnitt "Offene Entscheidungen").

Drei zusätzliche Kits (**Hard Trap (echt)**, **Bounce (echt)**, **Soulful
Vintage (echt)**) nutzen dagegen echte, CC0-lizenzierte Samples aus
[Boochi44/free-drum-samples](https://github.com/Boochi44/free-drum-samples)
(siehe `public/samples/LICENSE.md`). Das Pack deckt nur Kick/Snare/HiHat/
teilweise Toms ab — Crash/Ride/übrige Toms fallen pro Instrument automatisch
auf die Synthese-Engine zurück (`SampleKit.trigger()` gibt `false` zurück,
wenn kein Sample vorliegt; `HybridDrumEngine` spielt dann synthetisch).
Stilistisch sind das Hip-Hop/Trap-Kits — kein Ersatz für Metal/Punk/Country,
sondern eine zusätzliche Option mit echten statt synthetisierten Transienten.

Für weitere eigene Kits gilt dasselbe Format — sobald Dateien in der
richtigen Struktur vorliegen, nutzt die App sie automatisch statt der
Synthese (`src/audio/SampleKit.js` + `src/audio/HybridDrumEngine.js`), ganz
ohne Code-Änderung.

## Ordnerstruktur

```
public/samples/
  <kitId>/
    manifest.json
    kick_soft_1.wav
    kick_soft_2.wav
    kick_mid_1.wav
    ...
```

`<kitId>` entspricht der `id` aus `src/data/kits.js` (`standard`, `metal`,
`punk`, `country` — oder ein neu ergänztes Kit).

## manifest.json

```json
{
  "kick":         { "soft": ["kick_soft_1.wav", "kick_soft_2.wav"], "mid": ["kick_mid_1.wav"], "hard": ["kick_hard_1.wav", "kick_hard_2.wav"] },
  "snare":        { "soft": [...], "mid": [...], "hard": [...] },
  "hihat_closed": { "soft": [...], "mid": [...], "hard": [...] },
  "hihat_open":   { "soft": [...], "mid": [...], "hard": [...] },
  "crash":        { "mid": [...] },
  "ride":         { "mid": [...] },
  "tom_low":      { "mid": [...] },
  "tom_mid":      { "mid": [...] },
  "tom_high":     { "mid": [...] }
}
```

- Erlaubte Instrument-Keys: siehe `src/data/instruments.js` (identisch zum
  Pattern-Schema).
- Pro Instrument mindestens eine Velocity-Stufe (`soft` / `mid` / `hard`).
  Fehlt eine Stufe, fällt die Engine auf `mid` bzw. die erste vorhandene
  Stufe zurück.
- **Mehrere Dateien pro Stufe = Round-Robin**: die Engine spielt sie reihum
  ab, damit nicht jeder Hit identisch klingt.
- Dateipfade sind relativ zum Kit-Ordner (`public/samples/<kitId>/`).

## Verhalten

- Beim Kit-Wechsel versucht `HybridDrumEngine.loadSamples(kitId)`,
  `/samples/<kitId>/manifest.json` zu laden. 404 oder Ladefehler → stiller
  Fallback auf die Synthese-Engine, kein Fehlerzustand in der UI.
- HiHat-Choking (offene HiHat wird von einer folgenden geschlossenen
  abgeschnitten) funktioniert identisch mit echten Samples.
- Velocity-Layer-Auswahl entspricht `DrumSynth`s Tier-Grenzen: Gain `< 0.4`
  → soft, `< 0.8` → mid, sonst hard (Gain = Velocity / 127).

## Lizenzhinweis

Bevor du ein Fremd-Sample-Pack (z. B. MT Power Drum Kit) hier einbindest,
prüfe die Lizenzbedingungen — insbesondere ob das Weiterverbreiten der
Roh-Sample-Dateien als Asset in einer eigenen Anwendung/einem Git-Repo
erlaubt ist. Viele kostenlose Kits erlauben die Nutzung in fertiger Musik,
nicht aber das Repacken der Sample-Bibliothek selbst.
