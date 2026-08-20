// Lädt echte Sample-basierte Drum-Kits, falls vorhanden. Erwartet unter
// public/samples/<kitId>/manifest.json eine Zuordnung:
//
// {
//   "kick":  { "soft": ["kick_soft_1.wav", "kick_soft_2.wav"], "mid": [...], "hard": [...] },
//   "snare": { "soft": [...], "mid": [...], "hard": [...] },
//   ...
// }
//
// Instrument-Keys wie in src/data/instruments.js. Pro Velocity-Tier (soft/
// mid/hard) mehrere Dateien angeben = Round-Robin (reihum abwechselnd).
// Fehlt die manifest.json (z.B. weil noch keine echten Samples vorliegen),
// liefert tryLoad() null und die App bleibt bei der Synthese-Engine (siehe
// DrumSynth.js) — kein Fehlerzustand, sondern der normale Fallback.
//
// Das manifest muss nicht alle Instrumente abdecken: trigger() gibt false
// zurück, wenn für ein Instrument kein Sample vorliegt, damit
// HybridDrumEngine für genau dieses Instrument auf Synthese zurückfallen
// kann (z.B. Kick/Snare/HiHat als echte Samples, Crash/Ride/Toms synthetisch).
//
// Siehe docs/sample-kits.md für die genaue Ordnerstruktur.

const CHOKE_FADE = 0.03;

export class SampleKit {
  constructor(audioCtx, bus) {
    this.audioCtx = audioCtx;
    this.bus = bus;
    this.buffers = {}; // { instrument: { soft: AudioBuffer[], mid: [...], hard: [...] } }
    this.roundRobinIndex = {};
    this.activeOpenHihat = null;
  }

  static async tryLoad(audioCtx, bus, kitId) {
    let manifest;
    try {
      const res = await fetch(`/samples/${kitId}/manifest.json`);
      if (!res.ok) return null;
      manifest = await res.json();
    } catch {
      return null;
    }

    const kit = new SampleKit(audioCtx, bus);
    try {
      await kit._loadManifest(kitId, manifest);
    } catch (err) {
      console.warn(`Sample-Kit "${kitId}" konnte nicht vollständig geladen werden:`, err);
      return null;
    }
    return kit;
  }

  async _loadManifest(kitId, manifest) {
    const jobs = [];
    for (const [instrument, tiers] of Object.entries(manifest)) {
      this.buffers[instrument] = {};
      for (const [tier, files] of Object.entries(tiers)) {
        this.buffers[instrument][tier] = new Array(files.length);
        files.forEach((file, index) => {
          jobs.push(
            fetch(`/samples/${kitId}/${file}`)
              .then((res) => res.arrayBuffer())
              .then((data) => this.audioCtx.decodeAudioData(data))
              .then((decoded) => {
                this.buffers[instrument][tier][index] = decoded;
              })
          );
        });
      }
    }
    await Promise.all(jobs);
  }

  // Gibt true zurück, wenn ein echtes Sample gespielt wurde, sonst false
  // (kein Sample für dieses Instrument im Manifest — Aufrufer soll auf
  // Synthese zurückfallen).
  trigger(instrumentKey, gain, time) {
    const tiers = this.buffers[instrumentKey];
    if (!tiers) return false;

    const tierName = gain < 0.4 ? 'soft' : gain < 0.8 ? 'mid' : 'hard';
    const variants = tiers[tierName] ?? tiers.mid ?? Object.values(tiers)[0];
    if (!variants || variants.length === 0) return false;

    const rrKey = `${instrumentKey}_${tierName}`;
    const nextIndex = (this.roundRobinIndex[rrKey] ?? 0) % variants.length;
    this.roundRobinIndex[rrKey] = nextIndex + 1;
    const buffer = variants[nextIndex];
    if (!buffer) return false;

    if (instrumentKey === 'hihat_closed') {
      this._chokeOpenHihat(time);
    }

    const source = this.audioCtx.createBufferSource();
    source.buffer = buffer;
    const amp = this.audioCtx.createGain();
    amp.gain.value = gain;
    source.connect(amp).connect(this.bus);
    source.start(time);

    if (instrumentKey === 'hihat_open') {
      this._chokeOpenHihat(time);
      this.activeOpenHihat = { source, gainNode: amp };
      source.addEventListener('ended', () => {
        if (this.activeOpenHihat?.source === source) this.activeOpenHihat = null;
      });
    }

    return true;
  }

  _chokeOpenHihat(time) {
    const voice = this.activeOpenHihat;
    if (!voice) return;
    voice.gainNode.gain.cancelAndHoldAtTime(time);
    voice.gainNode.gain.linearRampToValueAtTime(0.0001, time + CHOKE_FADE);
    voice.source.stop(time + CHOKE_FADE + 0.005);
    this.activeOpenHihat = null;
  }
}
