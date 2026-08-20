// Drum-Kit-Presets. Jedes Kit hat zwei Ebenen:
// - `synth`: Parameter für die eingebaute Synthese-Engine (DrumSynth), damit
//   jedes Kit auch ohne Sample-Dateien sofort klanglich unterscheidbar ist.
// - `samplePath`: Ordnername unter public/samples/<samplePath>/. Liegt dort
//   eine manifest.json (siehe src/audio/SampleKit.js), werden automatisch
//   echte Samples statt Synthese verwendet — ohne Code-Änderung.
//
// Standard/Metal/Punk/Country laufen komplett über die Synthese (keine
// Sample-Dateien hinterlegt, siehe CLAUDE.md "Offene Entscheidungen").
//
// trap-hard/trap-bounce/vintage-soul nutzen echte, CC0-lizenzierte Samples
// aus github.com/Boochi44/free-drum-samples (siehe public/samples/LICENSE.md).
// Das Pack deckt nur Kick/Snare/HiHat/(Toms teilweise) ab — Crash/Ride/
// restliche Toms fallen automatisch auf die Synthese des jeweiligen Kits
// zurück (siehe HybridDrumEngine). Stilistisch sind das Hip-Hop/Trap-Kits,
// kein Ersatz für Metal/Punk/Country, sondern eine zusätzliche Option mit
// echten (nicht synthetisierten) Transienten.

export const DEFAULT_KIT_ID = 'standard';

// Fallback-Parameter für die drei "echten" Kits (trap-hard/trap-bounce/
// vintage-soul): kick/snare/hihat werden praktisch nie benutzt, da die
// Samples diese Instrumente abdecken — nur crash/ride/toms (teilweise)
// greifen wirklich auf diese Synthese-Werte zurück. Neutral gehalten
// (angelehnt an "standard"), damit es nicht gegen die echten Hits absticht.
const KITS_SYNTH_FALLBACK = {
  kick: { startFreq: 140, endFreq: 48, decay: 0.26, clickAmount: 0.3, clickFreq: 4000, distortion: 0.1 },
  snare: { noiseFreqSoft: 1300, noiseFreqMid: 950, noiseFreqHard: 750, toneFreq: 185, decay: 0.15, snap: 0.1 },
  hihat: { closedDecay: 0.06, openDecay: 0.32, closedFilterFreq: 7200, openFilterFreq: 6800 },
  crash: { decay: 1.0, filterFreq: 4200 },
  ride: { decay: 0.55, filterFreq: 6000, filterQ: 0.7 },
  toms: { pitchScale: 1, decay: 0.26 },
  bus: { threshold: -16, ratio: 3, reverbSend: 0.1, reverbDuration: 0.25, reverbDecayPower: 3 },
};

export const KITS = [
  {
    id: 'standard',
    name: 'Standard',
    description: 'Ausgewogenes Studio-Kit, neutral gestimmt.',
    samplePath: 'standard',
    synth: {
      kick: { startFreq: 150, endFreq: 45, decay: 0.3, clickAmount: 0.25, clickFreq: 3500, distortion: 0 },
      snare: { noiseFreqSoft: 1400, noiseFreqMid: 1000, noiseFreqHard: 800, toneFreq: 180, decay: 0.18, snap: 0 },
      hihat: { closedDecay: 0.06, openDecay: 0.35, closedFilterFreq: 7000, openFilterFreq: 6500 },
      crash: { decay: 1.2, filterFreq: 4000 },
      ride: { decay: 0.6, filterFreq: 6000, filterQ: 0.7 },
      toms: { pitchScale: 1, decay: 0.28 },
      bus: { threshold: -18, ratio: 3, reverbSend: 0.13, reverbDuration: 0.35, reverbDecayPower: 3 },
    },
  },
  {
    id: 'metal',
    name: 'Heavy Metal',
    description: 'Getriggert & komprimiert: knalliger Kick-Klick, straffe gegatete Snare, kaum Raum.',
    samplePath: 'metal',
    synth: {
      kick: { startFreq: 130, endFreq: 55, decay: 0.22, clickAmount: 0.6, clickFreq: 5000, distortion: 0.4 },
      snare: { noiseFreqSoft: 1800, noiseFreqMid: 1400, noiseFreqHard: 1100, toneFreq: 220, decay: 0.12, snap: 0.3 },
      hihat: { closedDecay: 0.05, openDecay: 0.28, closedFilterFreq: 8000, openFilterFreq: 7500 },
      crash: { decay: 1.0, filterFreq: 4500 },
      ride: { decay: 0.5, filterFreq: 6500, filterQ: 0.8 },
      toms: { pitchScale: 0.9, decay: 0.22 },
      bus: { threshold: -24, ratio: 6, reverbSend: 0.05, reverbDuration: 0.15, reverbDecayPower: 4 },
    },
  },
  {
    id: 'punk',
    name: 'Punk',
    description: 'Roh und schnell: trashige Becken, knackige Snare, kaum Bearbeitung.',
    samplePath: 'punk',
    synth: {
      kick: { startFreq: 140, endFreq: 48, decay: 0.24, clickAmount: 0.35, clickFreq: 4000, distortion: 0.15 },
      snare: { noiseFreqSoft: 1200, noiseFreqMid: 900, noiseFreqHard: 700, toneFreq: 190, decay: 0.14, snap: 0.15 },
      hihat: { closedDecay: 0.05, openDecay: 0.3, closedFilterFreq: 7500, openFilterFreq: 7000 },
      crash: { decay: 1.0, filterFreq: 3600 },
      ride: { decay: 0.5, filterFreq: 5500, filterQ: 0.7 },
      toms: { pitchScale: 1, decay: 0.24 },
      bus: { threshold: -16, ratio: 2.5, reverbSend: 0.08, reverbDuration: 0.2, reverbDecayPower: 3 },
    },
  },
  {
    id: 'country',
    name: 'Country',
    description: 'Warm und organisch: runde Toms, weiche Snare mit Brush-Charakter, natürlicher Raum.',
    samplePath: 'country',
    synth: {
      kick: { startFreq: 100, endFreq: 42, decay: 0.34, clickAmount: 0.05, clickFreq: 3000, distortion: 0 },
      snare: { noiseFreqSoft: 900, noiseFreqMid: 700, noiseFreqHard: 600, toneFreq: 150, decay: 0.22, snap: 0 },
      hihat: { closedDecay: 0.07, openDecay: 0.4, closedFilterFreq: 6000, openFilterFreq: 5800 },
      crash: { decay: 1.4, filterFreq: 3800 },
      ride: { decay: 0.7, filterFreq: 5000, filterQ: 0.6 },
      toms: { pitchScale: 1.05, decay: 0.32 },
      bus: { threshold: -14, ratio: 2, reverbSend: 0.2, reverbDuration: 0.5, reverbDecayPower: 3 },
    },
  },
  {
    id: 'trap-hard',
    name: 'Hard Trap (echt)',
    description:
      'Echte Samples (CC0, Boochi44/free-drum-samples): verzerrter Kick, harte Snare. Crash/Ride/übrige Toms synthetisch.',
    samplePath: 'trap-hard',
    synth: KITS_SYNTH_FALLBACK,
  },
  {
    id: 'trap-bounce',
    name: 'Bounce (echt)',
    description:
      'Echte Samples (CC0, Boochi44/free-drum-samples): runder Kick, straffe Snare. Crash/Ride/Tom Mid synthetisch.',
    samplePath: 'trap-bounce',
    synth: KITS_SYNTH_FALLBACK,
  },
  {
    id: 'vintage-soul',
    name: 'Soulful Vintage (echt)',
    description:
      'Echte Samples (CC0, Boochi44/free-drum-samples): warme Lo-Fi-Drums. Crash/Ride/Tom Mid synthetisch.',
    samplePath: 'vintage-soul',
    synth: KITS_SYNTH_FALLBACK,
  },
];

export function getKit(kitId) {
  return KITS.find((k) => k.id === kitId) ?? KITS[0];
}
