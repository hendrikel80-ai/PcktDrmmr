// Trims a finished recording to the end of the last complete bar, so it
// loops cleanly instead of ending mid-bar at whatever moment the user
// happened to click "Stop". One bar = 16 steps on the app's fixed
// scheduler grid, same assumption as Scheduler.js's `secondsPerStep` and
// midiExport.js's tick math: 16 * (60 / bpm / 4) = 240 / bpm seconds.

export function barDurationSeconds(bpm) {
  return 240 / (bpm || 120);
}

// Rounds `totalDurationSeconds` down to the last full bar boundary. If
// less than one full bar was recorded, there's nothing sensible to trim
// to — returns the original duration unchanged rather than producing an
// impossible (longer-than-recorded) or empty result.
export function computeLoopTrimSeconds(totalDurationSeconds, bpm) {
  const oneBar = barDurationSeconds(bpm);
  if (!(oneBar > 0) || !(totalDurationSeconds > 0)) return totalDurationSeconds;
  const completeBars = Math.floor(totalDurationSeconds / oneBar);
  if (completeBars < 1) return totalDurationSeconds;
  return completeBars * oneBar;
}

// Returns a new, shorter AudioBuffer containing only the first
// `durationSeconds` of `buffer`. `audioCtx` can be any BaseAudioContext
// (a real or Offline one) — only used for `createBuffer`.
export function trimAudioBuffer(audioCtx, buffer, durationSeconds) {
  const frameCount = Math.min(buffer.length, Math.round(durationSeconds * buffer.sampleRate));
  const trimmed = audioCtx.createBuffer(buffer.numberOfChannels, frameCount, buffer.sampleRate);
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    trimmed.copyToChannel(buffer.getChannelData(channel).subarray(0, frameCount), channel);
  }
  return trimmed;
}
