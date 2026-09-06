// Basic-Rock-Beat, 4/4, 130 BPM: durchgehende Achtel auf der geschlossenen
// HiHat, Bass Drum auf 1 und 3, Snare auf 2 und 4.
export const DEFAULT_PATTERN = {
  bpm: 130,
  time_signature: '4/4',
  bars: 1,
  style_description:
    'Basic-Rock-Beat: durchgehende Achtel auf der geschlossenen HiHat, Bass Drum auf 1 und 3, Snare auf 2 und 4',
  pattern: {
    kick:         [110,0,0,0, 0,0,0,0, 105,0,0,0, 0,0,0,0],
    snare:        [0,0,0,0, 100,0,0,0, 0,0,0,0, 100,0,0,0],
    hihat_closed: [85,0,70,0, 85,0,70,0, 85,0,70,0, 85,0,70,0],
  },
  humanize: true,
};
