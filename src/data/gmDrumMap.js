// General-MIDI-Percussion-Zuordnung (Kanal 10) für unsere Instrument-Keys.
// MT Power Drum Kit und die meisten Drum-VSTs folgen diesem Standard-Mapping.
export const GM_DRUM_MAP = {
  kick: 36, // Bass Drum 1
  snare: 38, // Acoustic Snare
  hihat_closed: 42, // Closed Hi-Hat
  hihat_open: 46, // Open Hi-Hat
  crash: 49, // Crash Cymbal 1
  ride: 51, // Ride Cymbal 1
  tom_low: 45, // Low Tom
  tom_mid: 48, // Hi-Mid Tom
  tom_high: 50, // High Tom
};

// GM-Percussion liegt konventionell auf Kanal 10 (1-indiziert) = 9 (0-indiziert).
export const GM_DRUM_CHANNEL = 9;
