import { STEPS_PER_BAR } from '../data/instruments';

// Lookahead-Scheduler nach dem bewährten Web-Audio-Muster
// ("A Tale of Two Clocks", Chris Wilson): ein Timer tickt häufig (25ms) und
// schaut ein kurzes Fenster in die Zukunft, aber der eigentliche Trigger-
// Zeitpunkt jedes Sounds wird als exakte audioCtx.currentTime-Zeit an die
// Web-Audio-Nodes übergeben. Dadurch kein Jitter durch Timer-Ungenauigkeit,
// wie es bei naivem setInterval-pro-Step der Fall wäre.
const SCHEDULE_AHEAD_TIME = 0.1; // Sekunden, die im Voraus geplant werden
const LOOKAHEAD_MS = 25; // Timer-Tick-Intervall

const HUMANIZE_TIMING_SECONDS = 0.012; // ~12ms Streubreite (Zielbereich 5-15ms lt. CLAUDE.md)
const HUMANIZE_VELOCITY_RANGE = 8; // max. Velocity-Abweichung (0-127-Skala)

// Summe zweier Gleichverteilungen ergibt eine Dreiecksverteilung: Abweichungen
// häufen sich näher an 0, wie beim Timing eines echten Schlagzeugers, statt
// gleichmäßig über den ganzen Bereich verteilt zu sein (CLAUDE.md: "nicht
// gleichmäßig verteilt").
function triangularRandom() {
  return Math.random() + Math.random() - 1; // -1..1
}

export class Scheduler {
  constructor(audioCtx, drumSynth) {
    this.audioCtx = audioCtx;
    this.drumSynth = drumSynth;
    this.pattern = null;
    this.currentStep = 0;
    this.nextNoteTime = 0;
    this.timerId = null;
    this.onStep = null; // callback(stepIndex) für UI-Highlight
    this.midiOut = null; // optional: sendet parallel GM-MIDI-Noten raus
  }

  setPattern(pattern) {
    this.pattern = pattern;
  }

  setMidiOut(midiOut) {
    this.midiOut = midiOut;
  }

  get totalSteps() {
    return (this.pattern?.bars ?? 1) * STEPS_PER_BAR;
  }

  get secondsPerStep() {
    const bpm = this.pattern?.bpm ?? 120;
    return 60 / bpm / 4; // 16tel-Steps
  }

  start() {
    if (this.timerId !== null || !this.pattern) return;
    this.currentStep = 0;
    this.nextNoteTime = this.audioCtx.currentTime + 0.05;
    this.timerId = setInterval(() => this._scheduler(), LOOKAHEAD_MS);
  }

  stop() {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  get isRunning() {
    return this.timerId !== null;
  }

  _scheduler() {
    while (this.nextNoteTime < this.audioCtx.currentTime + SCHEDULE_AHEAD_TIME) {
      this._scheduleStep(this.currentStep, this.nextNoteTime);
      this._advanceStep();
    }
  }

  _scheduleStep(stepIndex, time) {
    const { pattern, humanize } = this.pattern;
    const timingOffset = humanize ? triangularRandom() * HUMANIZE_TIMING_SECONDS : 0;
    const triggerTime = time + timingOffset;

    for (const [instrumentKey, steps] of Object.entries(pattern)) {
      const velocity = steps[stepIndex];
      if (!velocity) continue;
      const humanizedVelocity = humanize
        ? clamp(velocity + (Math.random() * 2 - 1) * HUMANIZE_VELOCITY_RANGE, 1, 127)
        : velocity;
      const gain = humanizedVelocity / 127;
      this.drumSynth.trigger(instrumentKey, gain, triggerTime);
      this.midiOut?.trigger(instrumentKey, humanizedVelocity, triggerTime);
    }

    if (this.onStep) {
      const delayMs = (time - this.audioCtx.currentTime) * 1000;
      setTimeout(() => this.onStep(stepIndex), Math.max(0, delayMs));
    }
  }

  _advanceStep() {
    this.nextNoteTime += this.secondsPerStep;
    this.currentStep = (this.currentStep + 1) % this.totalSteps;
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Math.round(value)));
}
