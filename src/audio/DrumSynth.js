// Synthetisiert Drum-Sounds direkt per Web Audio API (Oszillatoren + Noise-Buffer)
// statt Sample-Dateien abzuspielen: keine Lizenzfragen, kein Asset-Download,
// läuft sofort im Browser (siehe CLAUDE.md "Offene Entscheidungen" zur
// Sample-Quelle — noch nicht final geklärt).
//
// Die "Realistischerer Drum-Sound"-Punkte aus CLAUDE.md werden trotzdem
// abgebildet, nur eben synthetisch statt sample-basiert:
// - Velocity-Layer: Velocity wählt eine von drei Klangschichten (soft/mid/
//   hard) mit unterschiedlichem Timbre, nicht nur eine skalierte Lautstärke.
// - Round-Robin: jeder Hit bekommt eine kleine zufällige Parameter-Streuung
//   (Filterfrequenz, Pitch, Decay), damit aufeinanderfolgende Hits nicht
//   identisch klingen.
// - Hihat-Choking: eine offene HiHat wird abrupt gestoppt, sobald eine
//   geschlossene folgt.
// - Drumbus: alle Stimmen laufen über einen gemeinsamen Bus mit Kompression
//   und einem kurzen, algorithmisch erzeugten Raumhall statt einzeln direkt
//   auf die Ausgabe.
//
// Zusätzlich: jedes Kit (src/data/kits.js) liefert ein `synth`-Parameterset,
// mit dem sich Kick/Snare/Becken/Toms und der Drumbus pro Kit unterschiedlich
// charakterisieren lassen (z.B. Metal = knallig & komprimiert, Country =
// warm & offen), ohne dass sich trigger()/die Scheduler-Schnittstelle ändert.

import { DEFAULT_KIT_ID, getKit } from '../data/kits';

function createNoiseBuffer(audioCtx, durationSeconds) {
  const frameCount = Math.max(1, Math.floor(audioCtx.sampleRate * durationSeconds));
  const buffer = audioCtx.createBuffer(1, frameCount, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frameCount; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

// Kurze algorithmische Raum-Impulsantwort (Noise * abklingende Hüllkurve)
// statt einer aufgenommenen IR-Datei — bewusst kurz ("Room", kein langer Hall).
function createRoomImpulse(audioCtx, durationSeconds, decayPower) {
  const length = Math.floor(audioCtx.sampleRate * durationSeconds);
  const impulse = audioCtx.createBuffer(2, length, audioCtx.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** decayPower;
    }
  }
  return impulse;
}

// Weiche Sättigungskurve für den "Distortion"-Regler des Kicks (Metal-Kit).
function makeDistortionCurve(amount) {
  const samples = 1024;
  const curve = new Float32Array(samples);
  const k = amount * 100;
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  return curve;
}

// Zufällige Streuung um einen Basiswert (±amount als Anteil), simuliert die
// Klangvarianz von Round-Robin-Samples ohne echte Sample-Varianten.
function jitter(base, amount) {
  return base * (1 + (Math.random() * 2 - 1) * amount);
}

// Velocity (0-1-Gain) auf eine von drei Anschlagstärke-Schichten abbilden.
function velocityTier(gain) {
  if (gain < 0.4) return 'soft';
  if (gain < 0.8) return 'mid';
  return 'hard';
}

const CHOKE_FADE = 0.03;

function noiseVoice(ctx, buffer, destination, { gain, time, decay, filterType, filterFreq, filterQ }) {
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = filterFreq;
  if (filterQ !== undefined) filter.Q.value = filterQ;
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(gain, time);
  amp.gain.exponentialRampToValueAtTime(0.0015, time + decay);
  source.connect(filter).connect(amp).connect(destination);
  source.start(time);
  source.stop(time + decay + 0.05);
  return { source, gainNode: amp };
}

function toneVoice(ctx, destination, { type = 'sine', gain, time, startFreq, endFreq, pitchDecay = 0.14, decay }) {
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(startFreq, time);
  if (endFreq !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(endFreq, time + pitchDecay);
  }
  amp.gain.setValueAtTime(gain, time);
  amp.gain.exponentialRampToValueAtTime(0.001, time + decay);
  osc.connect(amp).connect(destination);
  osc.start(time);
  osc.stop(time + decay + 0.02);
  return { source: osc, gainNode: amp };
}

export class DrumSynth {
  // outputNode: Ziel des Drumbus. Default ctx.destination, aber
  // useAudioEngine übergibt einen gemeinsamen Master-Bus, damit Drums und
  // Gitarre (GuitarEngine) im selben Audio-Graph zusammenlaufen.
  constructor(audioCtx, kitConfig = getKit(DEFAULT_KIT_ID), outputNode = audioCtx.destination) {
    this.audioCtx = audioCtx;
    this.outputNode = outputNode;
    this.noiseBufferLong = createNoiseBuffer(audioCtx, 1.5);
    this.activeOpenHihat = null;
    this.preset = kitConfig.synth;
    this._buildDrumBus();
    this._applyBusPreset();
  }

  // Drumbus: alle Stimmen laufen hier zusammen, statt einzeln direkt auf
  // destination zu gehen. Trockener Pfad über Kompression, parallel dazu ein
  // dezenter Send auf einen kurzen Raumhall. Nodes werden auf `this` gehalten,
  // damit setKit() sie bei Kit-Wechsel neu parametrisieren kann.
  _buildDrumBus() {
    const ctx = this.audioCtx;

    this.bus = ctx.createGain();
    this.bus.gain.value = 1;

    this.compressor = ctx.createDynamicsCompressor();
    this.compressor.knee.value = 12;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.15;

    const master = ctx.createGain();
    master.gain.value = 0.9;

    this.reverbSend = ctx.createGain();
    this.convolver = ctx.createConvolver();
    const reverbReturn = ctx.createGain();
    reverbReturn.gain.value = 1;

    this.bus.connect(this.compressor).connect(master).connect(this.outputNode);
    this.bus.connect(this.reverbSend).connect(this.convolver).connect(reverbReturn).connect(master);
  }

  _applyBusPreset() {
    const { threshold, ratio, reverbSend, reverbDuration, reverbDecayPower } = this.preset.bus;
    this.compressor.threshold.value = threshold;
    this.compressor.ratio.value = ratio;
    this.reverbSend.gain.value = reverbSend;
    this.convolver.buffer = createRoomImpulse(this.audioCtx, reverbDuration, reverbDecayPower);
  }

  // Wechselt das Klangcharakter-Preset live, ohne den Audio-Graph neu
  // aufzubauen (Bus/Kompression/Hall werden nur umparametrisiert).
  setKit(kitConfig) {
    this.preset = kitConfig.synth;
    this._applyBusPreset();
  }

  // gain: 0..1 (aus Velocity 0..127 abgeleitet), time: AudioContext-Zeit in Sekunden
  trigger(instrumentKey, gain, time) {
    const fn = this[`_${instrumentKey}`];
    if (typeof fn !== 'function') return;
    fn.call(this, gain, time);
  }

  _chokeOpenHihat(time) {
    const voice = this.activeOpenHihat;
    if (!voice) return;
    voice.gainNode.gain.cancelAndHoldAtTime(time);
    voice.gainNode.gain.linearRampToValueAtTime(0.0001, time + CHOKE_FADE);
    voice.source.stop(time + CHOKE_FADE + 0.005);
    this.activeOpenHihat = null;
  }

  _kick(gain, time) {
    const ctx = this.audioCtx;
    const { startFreq, endFreq, decay, clickAmount, clickFreq, distortion } = this.preset.kick;
    const tier = velocityTier(gain);
    const tierFreqMul = tier === 'soft' ? 0.75 : tier === 'hard' ? 1.13 : 1;
    const tierDecayMul = tier === 'soft' ? 0.87 : 1;

    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(jitter(startFreq * tierFreqMul, 0.04), time);
    osc.frequency.exponentialRampToValueAtTime(jitter(endFreq, 0.08), time + 0.14);
    amp.gain.setValueAtTime(gain, time);
    amp.gain.exponentialRampToValueAtTime(0.001, time + jitter(decay * tierDecayMul, 0.1));

    if (distortion > 0) {
      const shaper = ctx.createWaveShaper();
      shaper.curve = makeDistortionCurve(distortion);
      osc.connect(amp).connect(shaper).connect(this.bus);
    } else {
      osc.connect(amp).connect(this.bus);
    }
    osc.start(time);
    osc.stop(time + decay + 0.05);

    if (tier === 'hard' && clickAmount > 0) {
      // Attack-Klick nur bei kräftigen Hits: mehr Punch im Anschlag.
      noiseVoice(ctx, this.noiseBufferLong, this.bus, {
        gain: gain * clickAmount,
        time,
        decay: 0.02,
        filterType: 'highpass',
        filterFreq: clickFreq,
      });
    }
  }

  _snare(gain, time) {
    const ctx = this.audioCtx;
    const { noiseFreqSoft, noiseFreqMid, noiseFreqHard, toneFreq, decay, snap } = this.preset.snare;
    const tier = velocityTier(gain);

    const noiseGain = tier === 'soft' ? gain * 0.9 : gain;
    const noiseFreq = tier === 'soft' ? noiseFreqSoft : tier === 'mid' ? noiseFreqMid : noiseFreqHard;
    const noiseDecay = tier === 'soft' ? decay * 0.55 : decay;

    noiseVoice(ctx, this.noiseBufferLong, this.bus, {
      gain: noiseGain,
      time,
      decay: jitter(noiseDecay, 0.1),
      filterType: 'highpass',
      filterFreq: jitter(noiseFreq, 0.08),
    });

    const toneGain = tier === 'soft' ? gain * 0.4 : gain * 0.7;
    toneVoice(ctx, this.bus, {
      type: 'triangle',
      gain: toneGain,
      time,
      startFreq: jitter(toneFreq, 0.03),
      decay: decay * 0.55,
    });

    if (tier === 'hard' && snap > 0) {
      // Zusätzliche hochfrequente Transiente für den "getriggerten" Crack
      // bei Metal/Punk-Snares.
      noiseVoice(ctx, this.noiseBufferLong, this.bus, {
        gain: gain * snap,
        time,
        decay: 0.03,
        filterType: 'highpass',
        filterFreq: 6000,
      });
    }
  }

  _hihat_closed(gain, time) {
    this._chokeOpenHihat(time);
    const { closedDecay, closedFilterFreq } = this.preset.hihat;
    const tier = velocityTier(gain);
    const tierFreqMul = tier === 'soft' ? 0.93 : tier === 'hard' ? 1.11 : 1;
    noiseVoice(this.audioCtx, this.noiseBufferLong, this.bus, {
      gain: gain * 0.6,
      time,
      decay: jitter(closedDecay, 0.2),
      filterType: 'highpass',
      filterFreq: jitter(closedFilterFreq * tierFreqMul, 0.06),
    });
  }

  _hihat_open(gain, time) {
    this._chokeOpenHihat(time);
    const { openDecay, openFilterFreq } = this.preset.hihat;
    const tier = velocityTier(gain);
    const tierFreqMul = tier === 'soft' ? 0.92 : tier === 'hard' ? 1.11 : 1;
    const voice = noiseVoice(this.audioCtx, this.noiseBufferLong, this.bus, {
      gain: gain * 0.6,
      time,
      decay: jitter(openDecay, 0.12),
      filterType: 'highpass',
      filterFreq: jitter(openFilterFreq * tierFreqMul, 0.06),
    });
    this.activeOpenHihat = voice;
    voice.source.addEventListener('ended', () => {
      if (this.activeOpenHihat?.source === voice.source) this.activeOpenHihat = null;
    });
  }

  _crash(gain, time) {
    const { decay, filterFreq } = this.preset.crash;
    noiseVoice(this.audioCtx, this.noiseBufferLong, this.bus, {
      gain: gain * 0.7,
      time,
      decay: jitter(decay, 0.08),
      filterType: 'highpass',
      filterFreq: jitter(filterFreq, 0.1),
    });
  }

  _ride(gain, time) {
    const { decay, filterFreq, filterQ } = this.preset.ride;
    noiseVoice(this.audioCtx, this.noiseBufferLong, this.bus, {
      gain: gain * 0.5,
      time,
      decay: jitter(decay, 0.1),
      filterType: 'bandpass',
      filterFreq: jitter(filterFreq, 0.08),
      filterQ,
    });
  }

  _tom_low(gain, time) {
    this._tom(gain, time, 110);
  }

  _tom_mid(gain, time) {
    this._tom(gain, time, 160);
  }

  _tom_high(gain, time) {
    this._tom(gain, time, 220);
  }

  _tom(gain, time, freq) {
    const { pitchScale, decay } = this.preset.toms;
    toneVoice(this.audioCtx, this.bus, {
      gain,
      time,
      startFreq: jitter(freq * pitchScale, 0.03),
      endFreq: jitter(freq * pitchScale * 0.6, 0.05),
      pitchDecay: 0.2,
      decay: jitter(decay, 0.08),
    });
  }
}
