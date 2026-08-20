// Gitarre live durch NAM (Neural Amp Modeler) schicken, parallel zum
// Drum-Sequencer im selben Audio-Graph (siehe CLAUDE.md
// "Gitarre live einspielen via NAM").
//
// Signalkette: getUserMedia-Quelle -> Input-Gain -> NAM-AudioWorklet
// (Amp-Modell-Inferenz) -> optionaler ConvolverNode (Cabinet-IR) ->
// Output-Gain -> gemeinsamer Master-Bus (siehe useAudioEngine.js).
//
// Nutzt die Low-Level-Engine-API von neural-amp-modeler-wasm (MIT-lizenziert,
// github.com/tone-3000/neural-amp-modeler-wasm) statt der fertigen
// React-Player-Komponente, damit sich die Kette frei in unseren eigenen
// Graphen einfügt. WASM/Worklet-Assets liegen unter public/nam/ (siehe
// scripts/copy-nam-assets.mjs).
//
// .nam-Modelldateien und Cabinet-IRs lädt der Nutzer selbst von der
// Festplatte (z.B. von tone3000.com) — wir bündeln bewusst keine, weil die
// Lizenz je nach Modell unterschiedlich ist (CLAUDE.md "Offene
// Entscheidungen" bzw. Aufgabe 4: "Lizenz der jeweiligen Modelle prüfen").

import { NamEngine } from 'neural-amp-modeler-wasm/engine';

const NAM_ASSET_BASE_URL = '/nam/';

export class GuitarEngine {
  constructor(audioCtx, masterOut) {
    this.audioCtx = audioCtx;
    this.masterOut = masterOut;

    this.stream = null;
    this.sourceNode = null;
    this.namEngine = null;
    this.namNode = null;
    this.cabConvolver = null;

    this.inputGain = audioCtx.createGain();
    this.outputGain = audioCtx.createGain();
    this.inputGain.gain.value = 1;
    this.outputGain.gain.value = 1;

    this.modelInfo = null; // zuletzt von loadModel() zurückgegebene NamModelInfo
  }

  static isSupported() {
    return typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);
  }

  get isConnected() {
    return Boolean(this.sourceNode);
  }

  async listInputDevices() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter((d) => d.kind === 'audioinput')
      .map((d) => ({ id: d.deviceId, name: d.label || 'Audio-Eingang' }));
  }

  // Fragt Mikrofon-/Interface-Zugriff an und baut die NAM-Kette auf.
  // deviceId optional: konkretes Interface (z.B. Scarlett) statt Standard.
  async connectInput(deviceId) {
    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }

    const constraints = {
      audio: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: 1,
      },
    };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);

    if (!this.namEngine) {
      this.namEngine = await NamEngine.attach(this.audioCtx, { assetBaseUrl: NAM_ASSET_BASE_URL });
    }
    if (!this.namNode) {
      this.namNode = await this.namEngine.createNode();
    }

    this.disconnectInput(); // vorherigen Stream (falls vorhanden) sauber schließen
    this.stream = stream;
    this.sourceNode = this.audioCtx.createMediaStreamSource(stream);
    this._rebuildChain();
  }

  disconnectInput() {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.sourceNode?.disconnect();
    this.stream = null;
    this.sourceNode = null;
  }

  // json: Textinhalt einer .nam-Datei (vom Nutzer per <input type="file"> gewählt).
  async loadModel(json) {
    if (!this.namNode) {
      throw new Error('Erst Gitarren-Eingang verbinden, bevor ein Modell geladen wird.');
    }
    this.modelInfo = await this.namNode.loadModel(json);
    return this.modelInfo;
  }

  async unloadModel() {
    await this.namNode?.unloadModel();
    this.modelInfo = null;
  }

  loadCabinetIR(audioBuffer) {
    this.cabConvolver?.disconnect();
    this.cabConvolver = this.audioCtx.createConvolver();
    this.cabConvolver.buffer = audioBuffer;
    this._rebuildChain();
  }

  clearCabinetIR() {
    this.cabConvolver?.disconnect();
    this.cabConvolver = null;
    this._rebuildChain();
  }

  setInputGain(value) {
    this.inputGain.gain.value = value;
  }

  setOutputGain(value) {
    this.outputGain.gain.value = value;
  }

  _rebuildChain() {
    this.sourceNode?.disconnect();
    this.inputGain.disconnect();
    this.namNode?.disconnect();
    this.cabConvolver?.disconnect();
    this.outputGain.disconnect();

    if (!this.sourceNode || !this.namNode) return;

    this.sourceNode.connect(this.inputGain);
    this.inputGain.connect(this.namNode);

    if (this.cabConvolver) {
      this.namNode.connect(this.cabConvolver);
      this.cabConvolver.connect(this.outputGain);
    } else {
      this.namNode.connect(this.outputGain);
    }

    this.outputGain.connect(this.masterOut);
  }

  async dispose() {
    this.disconnectInput();
    await this.namNode?.dispose();
    this.namNode = null;
  }
}
