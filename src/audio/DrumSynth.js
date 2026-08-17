// Synthetisiert Drum-Sounds direkt per Web Audio API (Oszillatoren + Noise-Buffer).
// Bewusst statt Sample-Dateien: keine Lizenzfragen, kein Asset-Download,
// läuft sofort im Browser. Kann später gegen echte Samples getauscht werden,
// ohne dass sich die Scheduler-Schnittstelle (triggerInstrument) ändert.

function createNoiseBuffer(audioCtx, durationSeconds) {
  const frameCount = Math.max(1, Math.floor(audioCtx.sampleRate * durationSeconds));
  const buffer = audioCtx.createBuffer(1, frameCount, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frameCount; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

export class DrumSynth {
  constructor(audioCtx) {
    this.audioCtx = audioCtx;
    this.noiseBufferLong = createNoiseBuffer(audioCtx, 1.5);
  }

  // gain: 0..1 (aus Velocity 0..127 abgeleitet), time: AudioContext-Zeit in Sekunden
  trigger(instrumentKey, gain, time) {
    const fn = this[`_${instrumentKey}`];
    if (typeof fn !== 'function') return;
    fn.call(this, gain, time);
  }

  _kick(gain, time) {
    const ctx = this.audioCtx;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(45, time + 0.14);
    amp.gain.setValueAtTime(gain, time);
    amp.gain.exponentialRampToValueAtTime(0.001, time + 0.3);
    osc.connect(amp).connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.32);
  }

  _snare(gain, time) {
    const ctx = this.audioCtx;

    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBufferLong;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 1000;
    const noiseAmp = ctx.createGain();
    noiseAmp.gain.setValueAtTime(gain, time);
    noiseAmp.gain.exponentialRampToValueAtTime(0.001, time + 0.18);
    noise.connect(noiseFilter).connect(noiseAmp).connect(ctx.destination);
    noise.start(time);
    noise.stop(time + 0.2);

    const osc = ctx.createOscillator();
    const oscAmp = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, time);
    oscAmp.gain.setValueAtTime(gain * 0.7, time);
    oscAmp.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
    osc.connect(oscAmp).connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.11);
  }

  _hihat_closed(gain, time) {
    this._hihat(gain, time, 0.06);
  }

  _hihat_open(gain, time) {
    this._hihat(gain, time, 0.35);
  }

  _hihat(gain, time, decay) {
    const ctx = this.audioCtx;
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBufferLong;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7000;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(gain * 0.6, time);
    amp.gain.exponentialRampToValueAtTime(0.001, time + decay);
    noise.connect(filter).connect(amp).connect(ctx.destination);
    noise.start(time);
    noise.stop(time + decay + 0.02);
  }

  _crash(gain, time) {
    const ctx = this.audioCtx;
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBufferLong;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 4000;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(gain * 0.7, time);
    amp.gain.exponentialRampToValueAtTime(0.001, time + 1.2);
    noise.connect(filter).connect(amp).connect(ctx.destination);
    noise.start(time);
    noise.stop(time + 1.25);
  }

  _ride(gain, time) {
    const ctx = this.audioCtx;
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBufferLong;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 6000;
    filter.Q.value = 0.7;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(gain * 0.5, time);
    amp.gain.exponentialRampToValueAtTime(0.001, time + 0.6);
    noise.connect(filter).connect(amp).connect(ctx.destination);
    noise.start(time);
    noise.stop(time + 0.65);
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
    const ctx = this.audioCtx;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, time);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.6, time + 0.2);
    amp.gain.setValueAtTime(gain, time);
    amp.gain.exponentialRampToValueAtTime(0.001, time + 0.28);
    osc.connect(amp).connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.3);
  }
}
