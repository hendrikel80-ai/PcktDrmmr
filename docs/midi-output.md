# Echten VST-Sound per MIDI-Out nutzen (z. B. MT Power Drum Kit)

Pocket Drummer kann Patterns zusätzlich zur eingebauten Audio-Engine als
General-MIDI-Percussion-Noten über [Web MIDI](https://developer.mozilla.org/en-US/docs/Web/API/Web_MIDI_API)
ausgeben. Damit kann ein echtes Drum-VST (z. B. MT Power Drum Kit), das in
einer DAW auf deinem Rechner läuft, live mitspielen — ohne dass wir
irgendwelche Sample-Dateien besitzen, herunterladen oder ins Repo legen
müssen. Der Sound kommt komplett von deinem eigenen, selbst installierten
Plugin.

**Browser-Voraussetzung:** Chrome oder Edge (Web MIDI API). Safari
unterstützt Web MIDI nicht, Firefox nur eingeschränkt — die App zeigt das
automatisch an, falls dein Browser nicht unterstützt wird.

## Setup

1. **Virtuelles MIDI-Kabel installieren**, damit der Browser MIDI an eine
   DAW senden kann:
   - Windows: [loopMIDI](https://www.tobias-erichsen.de/software/loopmidi.html)
     (kostenlos) — einmal starten, einen Port anlegen (z. B. "Pocket
     Drummer").
   - macOS: IAC Driver im Audio-MIDI-Setup aktivieren (Systemwerkzeug,
     kein Download nötig).
2. **DAW öffnen** (z. B. Reaper, Ableton, Cakewalk), eine MIDI-Spur
   anlegen, als MIDI-Eingang den virtuellen Port aus Schritt 1 wählen,
   Kanal 10 (GM-Percussion).
3. **MT Power Drum Kit** (oder ein anderes GM-kompatibles Drum-VST) auf
   dieser Spur als Instrument laden, Monitoring/Input aktivieren.
4. In Pocket Drummer auf **"🎹 MIDI-Ausgang aktivieren"** klicken, Browser
   fragt nach MIDI-Berechtigung → erlauben.
5. Im Dropdown den virtuellen Port aus Schritt 1 auswählen.
6. Play drücken — die DAW-Spur sollte jetzt bei jedem Hit Noten empfangen
   und über MT Power Drum Kit klingen.

## Wie es funktioniert

- Instrument-Keys werden auf General-MIDI-Percussion-Noten gemappt (siehe
  `src/data/gmDrumMap.js`), z. B. `kick` → Note 36, `snare` → Note 38.
- Die Web-Audio-Engine (Synthese/Kits) läuft **parallel weiter** — MIDI-Out
  ist ein zusätzlicher Ausgang, kein Ersatz. Du kannst die eingebauten Kits
  stummschalten/ignorieren, wenn du nur den VST-Sound hören willst.
- Timing wird zwischen `AudioContext`- und `performance.now()`-Zeitbasis
  umgerechnet (`MidiOut._audioTimeToPerfTime`), damit MIDI-Noten genauso
  präzise wie die interne Audio-Wiedergabe geplant werden.
- HiHat-Choking übernimmt das empfangende VST selbst (Standard-Verhalten
  bei GM-kompatiblen Drum-Plugins, die Closed/Open/Pedal-HiHat als
  gemeinsame Chokegroup behandeln) — dafür ist auf unserer Seite kein
  Extra-Code nötig.
