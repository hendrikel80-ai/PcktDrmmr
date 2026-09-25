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
- Tastenkürzel für die Aufnahme: Pfeil-rechts startet (mit 2 Takten
  Einzählen, unabhängig von der Taktart), Pfeil-links stoppt. Wird
  ignoriert, während irgendwo Text eingegeben wird (Pattern-Name,
  BPM-Feld, …).
- Takte-Stepper in der Transport-Leiste — Pattern manuell auf bis zu 8
  Takte erweitern/kürzen, statt nur über KI-Generierung oder Library
  mehrtaktige Patterns zu bekommen.
- Undo im Step-Sequencer (Button + Strg+Z) — für Step-Klicks, "Alles
  löschen", Takte-Änderungen und Pattern-Laden; bewusst nicht für
  BPM-Änderungen, sonst würde Halten des +/--Reglers den Verlauf fluten.
- Presets für die Amp-Einstellungen (Gain/Bass/Mid/Treble/Reverb/Output/
  Delay) — speichern/laden/löschen, analog zum bestehenden
  Pattern-Manager.

### Geändert
- Einzählen vor der Aufnahme zählt jetzt immer 2 Takte statt 1.
- Touch-Ziele in der Mobile-Ansicht auf ≥44px vergrößert (Step-Zellen,
  BPM-Stepper, generische Buttons/Inputs).
- Aufnahmen werden jetzt als MP3 statt WAV gespeichert (nativer ASIO-Pfad,
  Browser-Merge-Pfad und Mobile) — 192 kbps. Ältere WAV-Aufnahmen bleiben
  in der Liste sichtbar/löschbar.

### Sicherheit
- `kit_id` beim Laden eines Drum-Kits wird jetzt genauso validiert wie die
  übrigen IPC-Pfad-Parameter.
- Bekannte npm-Sicherheitslücken (qs/body-parser/express) gefixt.
