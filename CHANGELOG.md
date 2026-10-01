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
- Loop-Wiedergabe für Aufnahmen: ein 🔁-Häkchen pro Aufnahme in der Liste,
  standardmäßig an für mit "Loop recording" gemachte Takes.
- Song-/Arrangement-Modus: bereits gespeicherte Patterns zu einer
  geordneten Playlist verketten (je mit eigener Wiederholungszahl,
  umsortierbar), als eigener "▶ Play Song"-Ablauf mit Fortschrittsanzeige
  pro Abschnitt, wahlweise als Endlosschleife. Wird wie Patterns/Presets
  benannt gespeichert/geladen (`src/data/arrangementStorage.js`).

### Geändert
- Einzählen vor der Aufnahme zählt jetzt immer 2 Takte statt 1.
- Touch-Ziele in der Mobile-Ansicht auf ≥44px vergrößert (Step-Zellen,
  BPM-Stepper, generische Buttons/Inputs).
- Aufnahmen werden jetzt als MP3 statt WAV gespeichert (nativer ASIO-Pfad,
  Browser-Merge-Pfad und Mobile) — 192 kbps. Ältere WAV-Aufnahmen bleiben
  in der Liste sichtbar/löschbar.
- Beat-Library ist jetzt ins Frontend gebündelt statt über `/api/library`
  geladen (Route entfernt) — Library-Browser, Song-Builder und
  Library-Treffer in "Generate a Beat" funktionieren ohne laufenden Server,
  also auch im installierten Desktop-Programm.
- KI-Backend-Adresse über `VITE_API_BASE_URL` konfigurierbar. Ohne sie
  zeigt das installierte Programm "Generate a Beat" nur mit
  Library-Treffern und "Sound Like" als nicht verfügbar an, statt in einen
  Netzwerkfehler zu laufen. Fehlermeldungen für Endnutzer ohne
  Entwickler-Hinweise (`npm run dev:full` nur noch im Dev-Modus).

### Behoben
- "Loop recording" wurde beim nativen ASIO-Aufnahmepfad (Drums bereits
  nativ gemischt — das ist der Normalfall beim aktuell einzigen sichtbaren
  Kit) komplett ignoriert: die Checkbox hatte keine Wirkung, der Take
  wurde nie auf einen sauberen Takt-Rand getrimmt. Betraf nur den
  Merge-Fallback- und den reinen Browser-Pfad.
- Schlagzeug in Aufnahmen doppelt: die native Aufnahme-Engine hat pro Take
  keine Erinnerung daran, ob JS sich für diesen Take gegen native Drums
  entschieden hat (Merge-Fallback) — sie rendert weiter aus dem zuletzt
  erfolgreich geladenen Kit/Pattern, egal was JS vorhat. Neues Flag
  (`drum_recording_enabled`, von JS pro Take gesetzt) schaltet das jetzt
  sauber ab, sodass der Merge-Fallback nicht zusätzlich zu bereits
  vorhandenen nativen Drums noch die Browser-Drums obendrauf mischt.

### Sicherheit
- `kit_id` beim Laden eines Drum-Kits wird jetzt genauso validiert wie die
  übrigen IPC-Pfad-Parameter.
- Bekannte npm-Sicherheitslücken (qs/body-parser/express) gefixt.
- KI-Endpunkte (`/api/generate-pattern`, `/api/sound-like`) mit
  optionalem Shared-Secret-Token (`API_ACCESS_TOKEN`) und Rate-Limit
  (Standard 20 Anfragen / 10 Minuten) geschützt; Backend bindet nur noch an
  `127.0.0.1` statt an alle Netzwerk-Schnittstellen.
