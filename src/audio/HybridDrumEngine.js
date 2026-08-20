import { DrumSynth } from './DrumSynth';
import { SampleKit } from './SampleKit';

// Einheitliche trigger()-Schnittstelle für den Scheduler: nutzt echte Samples
// für das aktuelle Kit, sobald sie geladen sind, sonst die Synthese-Engine.
// Der Scheduler bekommt eine einzige Engine-Instanz und merkt vom
// Kit-Wechsel nichts.
export class HybridDrumEngine {
  constructor(audioCtx, kitConfig, outputNode = audioCtx.destination) {
    this.audioCtx = audioCtx;
    this.synth = new DrumSynth(audioCtx, kitConfig, outputNode);
    this.sampleKit = null;
  }

  setKit(kitConfig) {
    this.synth.setKit(kitConfig);
    this.sampleKit = null; // erst wieder aktiv, sobald loadSamples() für das neue Kit fertig ist
  }

  // Versucht, echte Samples für das Kit zu laden (siehe SampleKit.js).
  // Gibt zurück, ob echte Samples aktiv sind; sonst bleibt die Synthese aktiv.
  async loadSamples(kitId) {
    const kit = await SampleKit.tryLoad(this.audioCtx, this.synth.bus, kitId);
    this.sampleKit = kit;
    return Boolean(kit);
  }

  trigger(instrumentKey, gain, time) {
    const playedSample = this.sampleKit?.trigger(instrumentKey, gain, time) ?? false;
    if (!playedSample) {
      this.synth.trigger(instrumentKey, gain, time);
    }
  }
}
