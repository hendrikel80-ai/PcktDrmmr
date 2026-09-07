// Nimmt den gemeinsamen Master-Bus (Drums + Gitarre, siehe useAudioEngine.js)
// über einen MediaStreamAudioDestinationNode auf und liefert das Ergebnis
// als Blob — für lokalen Download, kein Cloud-Upload (CLAUDE.md "Riff-
// Aufnahme (lokal speichern)").

const PREFERRED_MIME_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];

function pickSupportedMimeType() {
  if (typeof MediaRecorder === 'undefined') return '';
  return PREFERRED_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) ?? '';
}

export class Recorder {
  constructor(stream) {
    this.stream = stream;
    this.mediaRecorder = null;
    this.chunks = [];
  }

  static isSupported() {
    return typeof MediaRecorder !== 'undefined';
  }

  get isRecording() {
    return this.mediaRecorder?.state === 'recording';
  }

  start() {
    if (this.isRecording) return;
    const mimeType = pickSupportedMimeType();
    this.chunks = [];
    this.mediaRecorder = new MediaRecorder(
      this.stream,
      mimeType ? { mimeType, audioBitsPerSecond: 192000 } : undefined
    );
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.mediaRecorder.start();
  }

  // Gibt den fertigen Blob zurück, sobald der Recorder wirklich gestoppt hat.
  stop() {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        reject(new Error('No recording in progress.'));
        return;
      }
      const recorder = this.mediaRecorder;
      recorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: recorder.mimeType || 'audio/webm' });
        this.chunks = [];
        resolve(blob);
      };
      recorder.stop();
    });
  }
}
