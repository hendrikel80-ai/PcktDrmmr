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

async function decodeToBuffer(audioCtx, arrayBuffer) {
  // decodeAudioData decodes into audioCtx's own sample rate regardless of
  // the source file's rate, so the two buffers below always end up
  // sample-rate-compatible for mixing without any manual resampling.
  return audioCtx.decodeAudioData(arrayBuffer);
}

function audioBufferToWavBlob(buffer) {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const numFrames = buffer.length;
  const blockAlign = numChannels * 2; // 16-bit PCM
  const dataSize = numFrames * blockAlign;
  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);

  function writeString(offset, str) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  }

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  const channelData = [];
  for (let ch = 0; ch < numChannels; ch++) channelData.push(buffer.getChannelData(ch));

  let offset = 44;
  for (let i = 0; i < numFrames; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channelData[ch][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

// `drumsBlob`: the webm/opus Blob from Recorder.js. `nativeWavPath`: the
// filesystem path from NativeGuitarEngine.getLastRecordingPath(). Returns
// a WAV Blob with both mixed together, or throws if either fails to decode.
export async function mergeRecordings(drumsBlob, nativeWavPath) {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  try {
    const nativeBytes = await window.__TAURI__.core.invoke('read_native_recording', {
      path: nativeWavPath,
    });

    const [drumsBuffer, nativeBuffer] = await Promise.all([
      decodeToBuffer(audioCtx, await drumsBlob.arrayBuffer()),
      decodeToBuffer(audioCtx, new Uint8Array(nativeBytes).buffer),
    ]);

    const sampleRate = audioCtx.sampleRate;
    const durationSec = Math.max(drumsBuffer.duration, nativeBuffer.duration);
    const offlineCtx = new OfflineAudioContext(2, Math.ceil(durationSec * sampleRate), sampleRate);

    const drumsSource = offlineCtx.createBufferSource();
    drumsSource.buffer = drumsBuffer;
    drumsSource.connect(offlineCtx.destination);
    drumsSource.start(0);

    const nativeSource = offlineCtx.createBufferSource();
    nativeSource.buffer = nativeBuffer;
    nativeSource.connect(offlineCtx.destination);
    nativeSource.start(0);

    const rendered = await offlineCtx.startRendering();
    return audioBufferToWavBlob(rendered);
  } finally {
    await audioCtx.close();
  }
}
