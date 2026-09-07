// Gitarre live durch einen eigenen, klassischen Amp-Simulator (rein native
// Web Audio Nodes) schicken, parallel zum Drum-Sequencer im selben
// Audio-Graph (siehe CLAUDE.md "Gitarre live einspielen via eigenem
// Amp-Simulator (Web Audio Nodes)").
//
// Hintergrund: NAM (neuronale Netz-Inferenz per WASM) hat sich als
// unvermeidbarer Latenz-Faktor herausgestellt (siehe docs/nam-guitar.md) —
// selbst mit einer sehr guten Interface-Latenz von 7.5ms kam die restliche
// Verzögerung direkt aus der Modell-Berechnung pro Audio-Block, nicht aus
// dem Routing, und ließ sich weder im Browser (kein SIMD-Schalter, festes
// 128-Sample-Render-Quantum) noch über verfügbare native Plugin-Builds
// sauber beheben. Ein klassischer Amp-Sim aus nativen Web Audio Nodes läuft
// dagegen direkt auf dem Audio-Thread ohne jede zusätzliche
// Inferenz-Latenz — wie ein Passthrough mit Klangfärbung.
//
// Signalkette:
//   getUserMedia-Quelle -> Input-Gain -> WaveShaperNode (Sättigung/
//   Verzerrung, feste tanh-Kurve — die Stärke der Verzerrung folgt dem
//   Pegel, den Input-Gain davor reinschiebt, wie bei einem echten Amp) ->
//   3-Band-Klangregelung (Bass/Mid/Treble) -> Reverb (ConvolverNode mit
//   prozedural erzeugter kurzer Raum-Impulsantwort, per Wet-Anteil
//   zumischbar) -> Output-Gain -> gemeinsamer Master-Bus (auch die Drums
//   laufen hier zusammen, siehe useAudioEngine.js).
//
// NAM bleibt als Code erhalten (weiter unten, aktuell nicht in die Kette
// eingebunden) — laut CLAUDE.md "zurückgestellt, nicht verworfen": könnte
// bei einem späteren Umbau auf eine native Desktop-App (Tauri + cpal,
// echter ASIO-Zugriff ohne Browser-Latenz-Nachteil) reaktiviert werden.

import { NamEngine } from 'neural-amp-modeler-wasm/engine';

const NAM_ASSET_BASE_URL = '/nam/';

// Übersetzt die kryptischen getUserMedia-DOMException-Namen in verständliche,
// handlungsleitende Meldungen statt z.B. nur "Could not start audio source".
function translateGetUserMediaError(err) {
  switch (err.name) {
    case 'NotReadableError':
      return 'Audio device could not be started (likely in use by another program or browser tab). Close other apps/tabs accessing the interface and try again.';
    case 'NotFoundError':
      return 'No matching audio input device found. Is the interface connected and visible as a recording device in Windows?';
    case 'NotAllowedError':
      return 'Microphone/interface access was denied. Grant permission again in the browser (icon in the address bar) or allow it in the site settings.';
    case 'OverconstrainedError':
      return `The chosen audio settings aren't supported by the device (${err.constraint ?? 'unknown constraint'}).`;
    default:
      return `Could not connect audio input: ${err.message || err.name}`;
  }
}

// Feste Sättigungskurve für den WaveShaper (symmetrisches tanh-Softclipping,
// klassischer Röhren-/Transistor-Amp-Charakter). Die tatsächliche Stärke der
// Verzerrung ergibt sich aus dem Pegel, den Input-Gain vor diesen Node
// schiebt — genau wie beim Gain-Regler eines echten Amps.
function createSaturationCurve(samples = 2048) {
  const curve = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1; // -1..1
    curve[i] = Math.tanh(x * 3);
  }
  return curve;
}

// Prozedural erzeugte kurze Raum-Impulsantwort (exponentiell abklingendes
// Rauschen) für den Reverb-ConvolverNode — kein externer Download, keine
// Lizenzfrage (siehe CLAUDE.md-Alternative "einfacher DelayNode-Feedback-
// Reverb"; das hier ist die ConvolverNode-Variante ohne Asset-Abhängigkeit).
function createRoomImpulse(ctx, duration = 1.2, decay = 2.5) {
  const rate = ctx.sampleRate;
  const length = Math.max(1, Math.floor(rate * duration));
  const impulse = ctx.createBuffer(2, length, rate);
  for (let channel = 0; channel < impulse.numberOfChannels; channel++) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return impulse;
}

export class GuitarEngine {
  constructor(audioCtx, masterOut) {
    this.audioCtx = audioCtx;
    this.masterOut = masterOut;

    this.stream = null;
    this.sourceNode = null;
    this.inputSplitter = null;

    // NAM (aktuell nicht in die aktive Kette eingebunden, siehe
    // Datei-Kommentar oben). Bleibt funktionsfähig für eine spätere
    // Reaktivierung, wird aber von dieser Klasse selbst nirgends mehr
    // aufgerufen.
    this.namEngine = null;
    this.namNode = null;
    this.modelInfo = null;

    this.inputGain = audioCtx.createGain();
    this.inputGain.gain.value = 1;

    this.waveshaper = audioCtx.createWaveShaper();
    this.waveshaper.curve = createSaturationCurve();
    // '2x' statt '4x': etwas weniger Anti-Aliasing-Reserve bei der
    // Verzerrung, dafür minimal geringere Verarbeitungslatenz — die
    // Ende-zu-Ende-Latenz ist ohnehin vom Windows/WASAPI-Systemboden
    // dominiert (siehe docs/nam-guitar.md), hier geht's nur um die letzten
    // Millisekunden.
    this.waveshaper.oversample = '2x';

    // 3-Band-Klangregelung nach der Verzerrung (Bass/Mid/Treble). Werte in
    // dB, 0 = neutral/unverändert.
    this.bassFilter = audioCtx.createBiquadFilter();
    this.bassFilter.type = 'lowshelf';
    this.bassFilter.frequency.value = 150;
    this.bassFilter.gain.value = 0;

    this.midFilter = audioCtx.createBiquadFilter();
    this.midFilter.type = 'peaking';
    this.midFilter.frequency.value = 800;
    this.midFilter.Q.value = 0.8;
    this.midFilter.gain.value = 0;

    this.trebleFilter = audioCtx.createBiquadFilter();
    this.trebleFilter.type = 'highshelf';
    this.trebleFilter.frequency.value = 3000;
    this.trebleFilter.gain.value = 0;

    // Reverb: trockenes Signal läuft immer voll durch (dryGain fix bei 1),
    // der Convolver-Zweig wird per reverbWetGain zugemischt (0 = aus).
    this.reverbConvolver = audioCtx.createConvolver();
    this.reverbConvolver.buffer = createRoomImpulse(audioCtx);
    this.reverbDryGain = audioCtx.createGain();
    this.reverbDryGain.gain.value = 1;
    this.reverbWetGain = audioCtx.createGain();
    this.reverbWetGain.gain.value = 0.15;

    this.outputGain = audioCtx.createGain();
    this.outputGain.gain.value = 1;

    // Die Effektkette selbst ist fix verdrahtet (anders als früher mit NAM
    // gibt es keine optionalen/austauschbaren Nodes mehr) — nur die
    // Eingangsquelle wechselt bei connectInput()/disconnectInput().
    this.inputGain.connect(this.waveshaper);
    this.waveshaper.connect(this.bassFilter);
    this.bassFilter.connect(this.midFilter);
    this.midFilter.connect(this.trebleFilter);

    this.trebleFilter.connect(this.reverbDryGain);
    this.trebleFilter.connect(this.reverbConvolver);
    this.reverbConvolver.connect(this.reverbWetGain);
    this.reverbDryGain.connect(this.outputGain);
    this.reverbWetGain.connect(this.outputGain);

    this.outputGain.connect(this.masterOut);
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

  // Fragt Mikrofon-/Interface-Zugriff an und hängt den Stream vorne an die
  // Effektkette. deviceId optional: konkretes Interface (z.B. Scarlett)
  // statt Standard.
  async connectInput(deviceId) {
    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }

    const preferredConstraints = {
      audio: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        // Kein channelCount-Zwang: eine feste "1" hätte den Browser bei
        // stereofähigen Interfaces zu einem Downmix (Mittelwert aus Kanal 1
        // + 2) gezwungen — bei einem leeren/rauschenden zweiten Kanal
        // halbiert das den Pegel und mischt dessen Rauschen mit rein. Wir
        // nehmen stattdessen unten explizit nur Kanal 0 heraus.
        // Bittet den Browser um den kleinstmöglichen Eingangspuffer statt der
        // für Video-Calls optimierten Default-Größe. "ideal" statt fixem Wert,
        // damit Browser/Geräte ohne Unterstützung nicht mit
        // OverconstrainedError abbrechen — wird dann einfach ignoriert.
        latency: { ideal: 0 },
      },
    };

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia(preferredConstraints);
    } catch (err) {
      // Manche Treiber (v.a. nach einem Treiber-Update) kommen mit der
      // Kombination aus deviceId:exact + niedrigen Latenz-/Kanal-Hints nicht
      // klar, obwohl das nur "ideal"-Wünsche sind — ein zweiter, bewusst
      // minimaler Versuch (nur deviceId als "ideal", sonst Browser-Defaults)
      // umgeht das oft, statt sofort aufzugeben.
      if (err.name === 'NotReadableError' && deviceId) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: { deviceId: { ideal: deviceId } },
          });
        } catch (retryErr) {
          throw new Error(translateGetUserMediaError(retryErr));
        }
      } else {
        throw new Error(translateGetUserMediaError(err));
      }
    }

    this.disconnectInput(); // vorherigen Stream (falls vorhanden) sauber schließen
    this.stream = stream;
    this.sourceNode = this.audioCtx.createMediaStreamSource(stream);
    // Beide Kanäle einzeln herausgreifen und mit voller Stärke auf denselben
    // Gain-Eingang summieren (WebAudio summiert mehrere Verbindungen auf
    // denselben Eingang automatisch), statt sie zu mitteln. So kommt das
    // Signal an, unabhängig davon, an welchem der beiden physischen
    // Interface-Eingänge die Gitarre hängt — reines Raten auf Kanal 0 hätte
    // bei Anschluss am zweiten Eingang komplett stumm geblieben. Ist ein
    // Kanal leer, liefert der Splitter dort laut Spec einfach Stille, trägt
    // also nichts zur Summe bei.
    this.inputSplitter = this.audioCtx.createChannelSplitter(2);
    this.sourceNode.connect(this.inputSplitter);
    this.inputSplitter.connect(this.inputGain, 0);
    this.inputSplitter.connect(this.inputGain, 1);
  }

  disconnectInput() {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.sourceNode?.disconnect();
    this.inputSplitter?.disconnect();
    this.stream = null;
    this.sourceNode = null;
    this.inputSplitter = null;
  }

  setInputGain(value) {
    this.inputGain.gain.value = value;
  }

  setOutputGain(value) {
    this.outputGain.gain.value = value;
  }

  // dB, üblich ca. -12 bis +12.
  setBass(db) {
    this.bassFilter.gain.value = db;
  }

  setMid(db) {
    this.midFilter.gain.value = db;
  }

  setTreble(db) {
    this.trebleFilter.gain.value = db;
  }

  // amount: 0 (trocken) bis 1 (voller Wet-Anteil, additiv zum immer vollen
  // Dry-Signal — kein Equal-Power-Crossfade, sondern ein einfacher Send-
  // Regler wie an den meisten Reverb-Pedalen).
  setReverb(amount) {
    this.reverbWetGain.gain.value = amount;
  }

  // Grobe Schätzung der aktuellen Ende-zu-Ende-Latenz in Millisekunden.
  // baseLatency = interner Web-Audio-Puffer (fix nach Context-Erzeugung),
  // outputLatency = tatsächliche Hardware-Ausgabelatenz (nur die Ausgabe-
  // Seite!), inputMs = vom Browser tatsächlich ausgehandelte Eingabe-
  // Pufferlatenz laut MediaTrackSettings (falls vom Browser unterstützt —
  // Chrome liefert das i.d.R.), erst nach aktivem Stream sinnvoll.
  // Rundtrip-Schätzung = input + base + output, da Eingabe- und Ausgabe-Seite
  // unabhängige Puffer sind (siehe docs/nam-guitar.md). Ohne NAM entfällt
  // die zusätzliche Inferenz-Rechenzeit, die früher hier mit reinspielte.
  getLatencyInfo() {
    const ctx = this.audioCtx;
    const baseMs = (ctx.baseLatency ?? 0) * 1000;
    const outputMs = (ctx.outputLatency ?? 0) * 1000;
    const track = this.stream?.getAudioTracks()[0];
    const trackLatency = track?.getSettings?.().latency;
    const inputMs = typeof trackLatency === 'number' ? trackLatency * 1000 : null;
    const totalMs = baseMs + outputMs + (inputMs ?? 0);
    return {
      inputMs: inputMs === null ? null : Math.round(inputMs * 10) / 10,
      baseMs: Math.round(baseMs * 10) / 10,
      outputMs: Math.round(outputMs * 10) / 10,
      totalMs: Math.round(totalMs * 10) / 10,
      totalIsPartial: inputMs === null, // Browser liefert keine Eingabe-Latenz -> totalMs unvollständig
      sampleRate: ctx.sampleRate,
    };
  }

  async dispose() {
    this.disconnectInput();
    await this.namNode?.dispose();
    this.namNode = null;
  }

  // --- NAM (zurückgestellt, siehe Datei-Kommentar oben) ---
  // Ab hier nichts, was die aktive Signalkette berührt oder von der
  // aktuellen UI aufgerufen wird. Für eine spätere Reaktivierung (z.B.
  // native Desktop-App via Tauri) bewusst funktionsfähig belassen.

  async _ensureNamEngine() {
    if (!this.namEngine) {
      this.namEngine = await NamEngine.attach(this.audioCtx, { assetBaseUrl: NAM_ASSET_BASE_URL });
    }
    if (!this.namNode) {
      this.namNode = await this.namEngine.createNode();
    }
    return this.namNode;
  }

  // json: Textinhalt einer .nam-Datei. Lädt das Modell auf einen (bei
  // Bedarf neu erzeugten) NAM-Node — der Node ist aktuell nicht in die
  // Effektkette eingehängt, hat also ohne weiteres Verdrahten keinen
  // hörbaren Effekt.
  async loadModel(json, options) {
    const namNode = await this._ensureNamEngine();
    this.modelInfo = await namNode.loadModel(json, options);
    return this.modelInfo;
  }

  async unloadModel() {
    await this.namNode?.unloadModel();
    this.modelInfo = null;
  }
}
