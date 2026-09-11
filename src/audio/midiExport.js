import { STEPS_PER_BAR } from '../data/instruments';

// Standard MIDI File (format 0, single track) export for the current
// pattern — lets the user drag a beat straight into a DAW as editable
// notes (not just a fixed audio clip). Steps are always 16th notes at
// `pattern.bpm`, matching how Scheduler.js actually plays them back
// (`secondsPerStep = 60 / bpm / 4`), independent of `time_signature`.

const PPQ = 480; // ticks per quarter note
const TICKS_PER_STEP = PPQ / 4; // 16th-note grid
const NOTE_GATE_TICKS = Math.floor(TICKS_PER_STEP / 2); // note-off before the next step
const DRUM_CHANNEL = 9; // MIDI channel 10 (0-indexed), the General MIDI percussion channel

// General MIDI percussion key map (channel 10).
const GM_DRUM_NOTES = {
  kick: 36, // Bass Drum 1
  snare: 38, // Acoustic Snare
  hihat_closed: 42, // Closed Hi-Hat
  hihat_open: 46, // Open Hi-Hat
  crash: 49, // Crash Cymbal 1
  ride: 51, // Ride Cymbal 1
  tom_high: 50, // High Tom
  tom_mid: 47, // Low-Mid Tom
  tom_low: 41, // Low Floor Tom
};

// MIDI variable-length quantity encoding (7 bits per byte, MSB = "more
// bytes follow"). Standard textbook algorithm from the MIDI spec.
function writeVarLen(value) {
  const bytes = [];
  let buffer = value & 0x7f;
  while ((value >>= 7) > 0) {
    buffer <<= 8;
    buffer |= 0x80 | (value & 0x7f);
  }
  // eslint-disable-next-line no-constant-condition
  while (true) {
    bytes.push(buffer & 0xff);
    if (buffer & 0x80) buffer >>= 8;
    else break;
  }
  return bytes;
}

function collectNoteEvents(pattern) {
  const totalSteps = pattern.bars * STEPS_PER_BAR;
  const events = [];

  for (const [instrumentKey, steps] of Object.entries(pattern.pattern)) {
    const note = GM_DRUM_NOTES[instrumentKey];
    if (note === undefined) continue; // no GM equivalent, skip defensively

    for (let step = 0; step < totalSteps && step < steps.length; step++) {
      const velocity = steps[step];
      if (!velocity) continue;
      const onTick = step * TICKS_PER_STEP;
      events.push({ tick: onTick, status: 0x90 | DRUM_CHANNEL, note, velocity });
      events.push({ tick: onTick + NOTE_GATE_TICKS, status: 0x80 | DRUM_CHANNEL, note, velocity: 0 });
    }
  }

  // Note-offs before note-ons at an identical tick, just as a defensive
  // tie-break (our fixed gate length never actually produces a collision).
  events.sort((a, b) => a.tick - b.tick || (a.status & 0x90 ? 1 : -1));
  return events;
}

function buildTrackBytes(pattern) {
  const bytes = [];
  let lastTick = 0;

  function pushEvent(tick, eventBytes) {
    bytes.push(...writeVarLen(tick - lastTick));
    bytes.push(...eventBytes);
    lastTick = tick;
  }

  const microsecondsPerQuarter = Math.round(60000000 / (pattern.bpm || 120));
  pushEvent(0, [
    0xff,
    0x51,
    0x03,
    (microsecondsPerQuarter >> 16) & 0xff,
    (microsecondsPerQuarter >> 8) & 0xff,
    microsecondsPerQuarter & 0xff,
  ]);

  const [numerator, denominator] = String(pattern.time_signature || '4/4')
    .split('/')
    .map(Number);
  const denominatorPower = Math.round(Math.log2(denominator || 4));
  pushEvent(0, [0xff, 0x58, 0x04, numerator || 4, denominatorPower, 24, 8]);

  for (const ev of collectNoteEvents(pattern)) {
    pushEvent(ev.tick, [ev.status, ev.note, ev.velocity]);
  }

  const endTick = Math.max(lastTick, pattern.bars * STEPS_PER_BAR * TICKS_PER_STEP);
  pushEvent(endTick, [0xff, 0x2f, 0x00]);

  return bytes;
}

export function patternToMidiBytes(pattern) {
  const trackBytes = buildTrackBytes(pattern);
  const trackLength = trackBytes.length;

  return new Uint8Array([
    0x4d, 0x54, 0x68, 0x64, // "MThd"
    0x00, 0x00, 0x00, 0x06, // header length
    0x00, 0x00, // format 0
    0x00, 0x01, // 1 track
    (PPQ >> 8) & 0xff, PPQ & 0xff, // division
    0x4d, 0x54, 0x72, 0x6b, // "MTrk"
    (trackLength >>> 24) & 0xff,
    (trackLength >>> 16) & 0xff,
    (trackLength >>> 8) & 0xff,
    trackLength & 0xff,
    ...trackBytes,
  ]);
}

function formatTimestamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(
    date.getHours()
  )}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}

export function downloadPatternAsMidi(pattern, filename = `pocket-studio-beat-${formatTimestamp()}.mid`) {
  const bytes = patternToMidiBytes(pattern);
  const blob = new Blob([bytes], { type: 'audio/midi' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
