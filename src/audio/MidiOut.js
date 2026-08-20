// Sendet Pattern-Events zusätzlich als Web-MIDI-Noten raus (General-MIDI-
// Percussion, Kanal 10), damit ein echtes VST-Drum-Plugin (z.B. MT Power
// Drum Kit) in einer DAW live mitspielt. Läuft parallel zur Audio-Engine
// (Synthese/Sample-Kit), ersetzt sie nicht — siehe docs/midi-output.md für
// das nötige Setup (virtuelles MIDI-Kabel + DAW).
//
// Web MIDI kennt keine AudioContext-Zeit, sondern plant über denselben
// Zeitraum wie performance.now(). trigger() rechnet die vom Scheduler
// übergebene audioCtx-Zeit deshalb in eine performance.now()-Zeit um.

import { GM_DRUM_CHANNEL, GM_DRUM_MAP } from '../data/gmDrumMap';

const NOTE_DURATION_MS = 30;
const NOTE_ON = 0x90 | GM_DRUM_CHANNEL;
const NOTE_OFF = 0x80 | GM_DRUM_CHANNEL;

export class MidiOut {
  constructor(audioCtx) {
    this.audioCtx = audioCtx;
    this.access = null;
    this.output = null;
    this.onOutputsChanged = null; // optionaler Callback(outputs) für die UI
  }

  static isSupported() {
    return typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator;
  }

  async requestAccess() {
    if (!MidiOut.isSupported()) {
      throw new Error('Web MIDI wird von diesem Browser nicht unterstützt (funktioniert in Chrome/Edge).');
    }
    this.access = await navigator.requestMIDIAccess({ sysex: false });
    this.access.onstatechange = () => {
      this.onOutputsChanged?.(this.listOutputs());
    };
    return this.listOutputs();
  }

  listOutputs() {
    if (!this.access) return [];
    return Array.from(this.access.outputs.values()).map((o) => ({ id: o.id, name: o.name }));
  }

  setOutput(portId) {
    this.output = this.access?.outputs.get(portId) ?? null;
  }

  // instrumentKey: wie in src/data/instruments.js, velocity: 0-127
  trigger(instrumentKey, velocity, time) {
    if (!this.output) return;
    const note = GM_DRUM_MAP[instrumentKey];
    if (note === undefined) return;

    const v = Math.max(1, Math.min(127, Math.round(velocity)));
    const perfTime = this._audioTimeToPerfTime(time);

    this.output.send([NOTE_ON, note, v], perfTime);
    this.output.send([NOTE_OFF, note, 0], perfTime + NOTE_DURATION_MS);
  }

  _audioTimeToPerfTime(audioTime) {
    // Frisch pro Aufruf berechnet statt gecacht, damit kein Clock-Drift
    // über eine lange Session entsteht.
    const offsetMs = performance.now() - this.audioCtx.currentTime * 1000;
    return offsetMs + audioTime * 1000;
  }
}
