// Feeds natively-captured guitar audio (NativeGuitarEngine.drainAudio(),
// via the Rust-side recording tap in asio_engine.rs) into a Web Audio
// destination that ONLY the recording stream listens to — never
// audioCtx.destination. The native guitar chain already plays out of the
// speakers directly through ASIO at near-zero latency; if this tap's
// samples also reached audioCtx.destination, the guitar would be audible
// twice (native + browser, at different latencies) as a phasey echo.
// useAudioEngine.js connects this tap's output to recordingDestination
// only, in parallel with masterOut (which carries the drums and DOES
// reach the speakers).
//
// Chunks arrive via polling (~every GUITAR_CHUNK_SIZE/sampleRate seconds)
// rather than as a continuous stream, so playback is scheduled against a
// running cursor (nextTime) instead of "play now" — back-to-back
// AudioBufferSourceNodes give gapless output as long as chunks keep
// arriving faster than they play out. If polling ever falls behind (tab
// throttled, IPC hiccup), nextTime resets to "now + lookahead" and the
// recording just gets a short gap rather than samples scheduled in the
// past (which Web Audio would otherwise clamp to now, causing overlap).
const LOOKAHEAD_SEC = 0.08;

export class GuitarRecordingTap {
  constructor(audioCtx, destinationNode) {
    this.audioCtx = audioCtx;
    this.destinationNode = destinationNode;
    this.nextTime = null;
  }

  pushSamples(samples, sampleRate) {
    if (!samples || samples.length === 0) return;
    const buffer = this.audioCtx.createBuffer(1, samples.length, sampleRate);
    buffer.copyToChannel(Float32Array.from(samples), 0);

    const source = this.audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.destinationNode);

    const now = this.audioCtx.currentTime;
    if (this.nextTime === null || this.nextTime < now) {
      this.nextTime = now + LOOKAHEAD_SEC;
    }
    source.start(this.nextTime);
    this.nextTime += buffer.duration;
  }

  reset() {
    this.nextTime = null;
  }
}
