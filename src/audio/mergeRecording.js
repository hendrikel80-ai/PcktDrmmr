// Mixes the browser's drum recording (webm/opus Blob, from Recorder.js)
// together with the native guitar+mic WAV file (written straight to disk
// by Rust — see asio_engine.rs) into a single new WAV file, entirely in
// the browser: both formats decode fine via Web Audio's decodeAudioData
// (opus and WAV are both natively supported), so no server-side/native
// mixing code is needed. Assumes both recordings started at effectively
// the same real moment (recorder.start() and
// guitar.setRecordingActive(true) are called back-to-back synchronously
// in useAudioEngine.js's toggleRecording) — good enough for a practice
// tool, not claiming sample-accurate alignment.

import { audioBufferToWavBlob } from './wavEncode';

async function decodeToBuffer(audioCtx, arrayBuffer) {
  // decodeAudioData decodes into audioCtx's own sample rate regardless of
  // the source file's rate, so the two buffers below always end up
  // sample-rate-compatible for mixing without any manual resampling.
  return audioCtx.decodeAudioData(arrayBuffer);
}

// `drumsBlob`: the webm/opus Blob from Recorder.js. `nativeWavPath`: the
// filesystem path from NativeGuitarEngine.getLastRecordingPath().
// `trimSeconds`: optional loop-trim point (see loopTrim.js) — when given,
// both sources are cut to exactly this length instead of the natural
// (usually slightly mismatched) longer of the two. `syncOffsetMs`: manual
// calibration knob (see RecordingPanel.jsx) for a small, fairly constant
// latency difference between the native ASIO capture path and the
// browser's WASAPI/MediaRecorder one — positive delays the guitar/mic
// track (use when it's arriving early relative to the drums), negative
// delays the drums track instead. `expectedNativeDurationSec`: the real
// wall-clock duration the take actually lasted (measured independently in
// useAudioEngine.js) — see the clock-drift comment below. Returns a WAV
// Blob with both mixed together, or throws if either fails to decode.
export async function mergeRecordings(
  drumsBlob,
  nativeWavPath,
  trimSeconds = null,
  syncOffsetMs = 0,
  expectedNativeDurationSec = null
) {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  try {
    const nativeBytes = await window.__TAURI__.core.invoke('read_native_recording', {
      path: nativeWavPath,
    });

    const [drumsBuffer, nativeBuffer] = await Promise.all([
      decodeToBuffer(audioCtx, await drumsBlob.arrayBuffer()),
      decodeToBuffer(audioCtx, new Uint8Array(nativeBytes).buffer),
    ]);

    // The native ASIO capture clock and the browser's own audio clock are
    // two independent, unsynced hardware/OS clocks — even a tiny relative
    // rate error between them compounds over a take into an increasingly
    // audible drift (measured on a real recording: ~0.2%, guitar/mic
    // ending up ~300ms behind the drums after about a minute — reported
    // as "the guitar sounds slower", which is exactly what a growing lag
    // feels like). Nudging the native source's played-back speed so its
    // effective duration matches how long the take actually lasted in
    // real time (independently measured, not derived from this decode)
    // cancels that out.
    let nativePlaybackRate = 1;
    if (expectedNativeDurationSec && nativeBuffer.duration > 0) {
      const ratio = nativeBuffer.duration / expectedNativeDurationSec;
      // Sanity bound: only trust this as clock drift, not some unrelated
      // hiccup (e.g. a stalled wall-clock timer) — anything wilder than
      // ±20% likely means expectedNativeDurationSec itself is bad, and
      // applying it blind would do more harm than good.
      if (ratio > 0.8 && ratio < 1.2) nativePlaybackRate = ratio;
    }
    const effectiveNativeDuration = nativeBuffer.duration / nativePlaybackRate;

    const sampleRate = audioCtx.sampleRate;
    const baseDurationSec = trimSeconds ?? Math.max(drumsBuffer.duration, effectiveNativeDuration);
    const syncOffsetSec = syncOffsetMs / 1000;
    const drumsStartSec = syncOffsetSec < 0 ? -syncOffsetSec : 0;
    const nativeStartSec = syncOffsetSec > 0 ? syncOffsetSec : 0;
    const durationSec = baseDurationSec + Math.abs(syncOffsetSec);
    const offlineCtx = new OfflineAudioContext(2, Math.ceil(durationSec * sampleRate), sampleRate);

    const drumsSource = offlineCtx.createBufferSource();
    drumsSource.buffer = drumsBuffer;
    drumsSource.connect(offlineCtx.destination);
    drumsSource.start(drumsStartSec);

    const nativeSource = offlineCtx.createBufferSource();
    nativeSource.buffer = nativeBuffer;
    nativeSource.playbackRate.value = nativePlaybackRate;
    nativeSource.connect(offlineCtx.destination);
    nativeSource.start(nativeStartSec);

    const rendered = await offlineCtx.startRendering();
    return audioBufferToWavBlob(rendered);
  } finally {
    await audioCtx.close();
  }
}
