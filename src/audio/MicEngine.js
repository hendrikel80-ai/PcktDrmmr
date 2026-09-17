// Minimaler Mikrofon-/Interface-Eingang für die Mobile-App: nur Pegel +
// Aufnahme, bewusst OHNE die Amp-Sim-Kette aus GuitarEngine.js (Waveshaper-
// Verzerrung, 3-Band-Klangregelung, Reverb) — für akustische Gitarre übers
// eingebaute Handy-/Tablet-Mikrofon soll der Ton unverfälscht durchkommen,
// nicht wie ein E-Gitarren-Amp gefärbt werden. Geräteauswahl-Logik bewusst
// dupliziert statt aus GuitarEngine.js importiert (siehe Plan), damit der
// Desktop-kritische Pfad dort unangetastet bleibt.
//
// Kette: getUserMedia-Quelle -> GainNode -> gemeinsamer Master-Bus (auch
// die Drums laufen hier zusammen, siehe useMobileAudioEngine.js).

function translateGetUserMediaError(err) {
  switch (err.name) {
    case 'NotReadableError':
      return 'Audio device could not be started (likely in use by another app). Close other apps using the microphone/interface and try again.';
    case 'NotFoundError':
      return 'No matching audio input device found.';
    case 'NotAllowedError':
      return 'Microphone access was denied. Allow it again in your browser/site settings.';
    case 'OverconstrainedError':
      return `The chosen audio settings aren't supported by the device (${err.constraint ?? 'unknown constraint'}).`;
    default:
      return `Could not connect audio input: ${err.message || err.name}`;
  }
}

export class MicEngine {
  constructor(audioCtx, masterOut) {
    this.audioCtx = audioCtx;
    this.masterOut = masterOut;

    this.stream = null;
    this.sourceNode = null;
    this.inputSplitter = null;

    this.inputGain = audioCtx.createGain();
    this.inputGain.gain.value = 1;
    this.inputGain.connect(this.masterOut);
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
      .map((d) => ({ id: d.deviceId, name: d.label || 'Audio input' }));
  }

  // deviceId optional: konkretes Gerät (z.B. ein angeschlossenes Interface)
  // statt des Standard-Mikrofons.
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
      },
    };

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      throw new Error(translateGetUserMediaError(err));
    }

    this.disconnectInput(); // vorherigen Stream (falls vorhanden) sauber schließen
    this.stream = stream;
    this.sourceNode = this.audioCtx.createMediaStreamSource(stream);
    // Beide Kanäle einzeln herausgreifen und summieren statt zu mitteln
    // (siehe GuitarEngine.js's connectInput für die ausführliche
    // Begründung) — funktioniert unabhängig davon, an welchem physischen
    // Eingang ein Interface das Signal anliefert.
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

  dispose() {
    this.disconnectInput();
  }
}
