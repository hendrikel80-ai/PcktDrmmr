// Beispiel-Pattern aus CLAUDE.md: Punk Beat 4/4, 160 BPM.
export const DEFAULT_PATTERN = {
  bpm: 160,
  time_signature: '4/4',
  bars: 1,
  style_description:
    'Klassischer Punk-Beat: treibende durchgehende Achtel auf der HiHat, Snare auf 2 und 4, Kick auf 1 und die "and" von 2',
  pattern: {
    kick:         [110,0,0,0, 0,0,90,0, 0,0,0,0, 110,0,0,0],
    snare:        [0,0,0,0, 100,0,0,0, 0,0,0,0, 105,0,0,0],
    hihat_closed: [80,60,80,60, 80,60,80,60, 80,60,80,60, 80,60,80,60],
  },
  humanize: true,
};
