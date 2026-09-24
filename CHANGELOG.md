# Changelog

Nennenswerte Änderungen an Pocket Studio, ab hier laufend gepflegt. Format
angelehnt an [Keep a Changelog](https://keepachangelog.com/de/1.0.0/).
Ältere Änderungen vor diesem Eintrag wurden nicht rückwirkend erfasst —
siehe dafür die Git-Historie.

## [Unveröffentlicht]

### Hinzugefügt
- ASIO-Geräte- und Kanal-Auswahl (Settings-Dialog) statt fest codierter
  Focusrite-Erkennung — andere Interfaces sind jetzt nutzbar.
- Datenschutz- & Credits-Hinweis, erreichbar über den Footer (Desktop und
  Mobile).
- `LICENSE`-Datei im Repo-Root.
- Release-Workflow über GitHub Actions (`.github/workflows/release.yml`) —
  baut bei einem gepushten Git-Tag automatisch den Windows-Installer und
  legt ihn als Draft-Release auf GitHub ab.
- "Send Feedback"-Button im Footer (Desktop und Mobile) — öffnet das
  E-Mail-Programm mit vorausgefülltem Betreff/Text (inkl. App-Version und
  Plattform) an `feedback.pocketstudio@gmail.com`.

### Geändert
- Touch-Ziele in der Mobile-Ansicht auf ≥44px vergrößert (Step-Zellen,
  BPM-Stepper, generische Buttons/Inputs).

### Sicherheit
- `kit_id` beim Laden eines Drum-Kits wird jetzt genauso validiert wie die
  übrigen IPC-Pfad-Parameter.
- Bekannte npm-Sicherheitslücken (qs/body-parser/express) gefixt.
