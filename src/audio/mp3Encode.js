// Named-export ESM build of lamejs — NOT the plain `lamejs` npm package,
// whose bundled internals reference an undefined `MPEGMode` global when
// pulled through a modern bundler like Vite (a known upstream bug, see
// https://github.com/zhuker/lamejs/issues/91). This fork fixes that.
import { Mp3Encoder } from '@breezystack/lamejs';

// lamejs' own recommended chunk size per encodeBuffer() call — an MP3
// frame is 1152 samples, feeding it anything else still works but wastes
// some internal buffering.
const SAMPLES_PER_FRAME = 1152;

function floatTo16BitPCM(channelData) {
  const int16 = new Int16Array(channelData.length);
  for (let i = 0; i < channelData.length; i++) {
    const sample = Math.max(-1, Math.min(1, channelData[i]));
    int16[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return int16;
}

// Takes an AudioBuffer, returns an MP3 Blob. 192kbps matches the bitrate
// the native ASIO path encodes at (see asio_engine.rs), so quality is
// consistent across every recording path.
export function audioBufferToMp3Blob(buffer, kbps = 192) {
  const numChannels = Math.min(buffer.numberOfChannels, 2);
  const encoder = new Mp3Encoder(numChannels, buffer.sampleRate, kbps);

  const left = floatTo16BitPCM(buffer.getChannelData(0));
  const right = numChannels > 1 ? floatTo16BitPCM(buffer.getChannelData(1)) : null;

  const chunks = [];
  for (let i = 0; i < left.length; i += SAMPLES_PER_FRAME) {
    const leftChunk = left.subarray(i, i + SAMPLES_PER_FRAME);
    const mp3buf = right
      ? encoder.encodeBuffer(leftChunk, right.subarray(i, i + SAMPLES_PER_FRAME))
      : encoder.encodeBuffer(leftChunk);
    if (mp3buf.length > 0) chunks.push(mp3buf);
  }
  const finalChunk = encoder.flush();
  if (finalChunk.length > 0) chunks.push(finalChunk);

  return new Blob(chunks, { type: 'audio/mpeg' });
}
