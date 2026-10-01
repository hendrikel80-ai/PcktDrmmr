import { useEffect, useRef, useState } from 'react';
import { isTauriRuntime } from '../utils/platform';
import { isTextEntryTarget } from '../utils/isTextEntryTarget';
import NumberStepper from './NumberStepper';
import LoopWaveform from './LoopWaveform';

// Counts up musically (1, 2, 3, [4]) as a count-in instead of a plain
// "get ready" countdown — the number of counted beats and their tempo
// follow the current pattern's time signature and BPM, so the player can
// come in exactly on beat 1 of the recording.
function beatsPerBarFromTimeSignature(timeSignature) {
  const numerator = parseInt(String(timeSignature).split('/')[0], 10);
  return Number.isFinite(numerator) && numerator > 0 ? numerator : 4;
}

// Always two full bars of count-in, regardless of time signature — long
// enough to settle into the tempo before playing, without dragging on for
// odd meters with a high beat count.
const COUNT_IN_BARS = 2;

// A take made with "Loop recording" on gets "-loop" in its filename (see
// useAudioEngine.js) — used to default its playback to looping too,
// otherwise the whole point of trimming it to a clean bar boundary is
// lost the moment you actually listen to it.
function isLoopTake(filename) {
  return typeof filename === 'string' && filename.includes('-loop');
}

// The editable part of a recording's name — the extension is always kept
// (see useAudioEngine.js's renameRecording), so only the base name is
// shown/edited here.
function baseName(filename) {
  const dotIndex = filename.lastIndexOf('.');
  return dotIndex >= 0 ? filename.slice(0, dotIndex) : filename;
}

function formatElapsed(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// M:SS:cc display/entry for the loop-trim stepper (see NumberStepper's
// optional format/parse props) — two-digit centiseconds, not three-digit
// milliseconds: the stepper's own step size is 10ms, so a third digit
// would always just read 0. The underlying value NumberStepper steps and
// clamps stays plain milliseconds throughout; only how it's shown/typed
// changes here (×10 / ÷10 at the boundary).
function formatMsAsClock(totalMs) {
  const clamped = Math.max(0, Math.round(totalMs));
  let totalSeconds = Math.floor(clamped / 1000);
  let centiseconds = Math.round((clamped % 1000) / 10);
  if (centiseconds >= 100) {
    centiseconds = 0;
    totalSeconds += 1;
  }
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60);
  return `${minutes}:${String(seconds).padStart(2, '0')}:${String(centiseconds).padStart(2, '0')}`;
}

function parseClockAsMs(text) {
  const match = text.trim().match(/^(\d+):([0-5]?\d):(\d{1,2})$/);
  if (!match) return NaN;
  const [, minutes, seconds, centiseconds] = match;
  return (parseInt(minutes, 10) * 60 + parseInt(seconds, 10)) * 1000 + parseInt(centiseconds, 10) * 10;
}

// Finds where real signal starts in a decoded buffer, scanning only the
// first half-second (encoder padding is always a handful of milliseconds,
// never anywhere near that long) — used as the Web Audio loop's restart
// point so gapless playback skips the MP3 encoder's silent lead-in on every
// pass instead of just the first. -45dBFS sits safely below encoder-silence
// noise floor while still catching even a quiet pickup/mic onset.
const SILENCE_AMPLITUDE_THRESHOLD = 0.0056; // ~ -45 dBFS
function detectLeadingSilenceSeconds(audioBuffer) {
  const data = audioBuffer.getChannelData(0);
  const scanLimit = Math.min(data.length, Math.floor(audioBuffer.sampleRate * 0.5));
  for (let i = 0; i < scanLimit; i++) {
    if (Math.abs(data[i]) > SILENCE_AMPLITUDE_THRESHOLD) {
      return i / audioBuffer.sampleRate;
    }
  }
  return 0;
}

// The other half of the same problem: MP3 encoders also pad silence onto
// the END of the file (to flush the encoder's filterbank) — left at its
// natural full duration, the loop plays all the way through that trailing
// silence before restarting, which is audible as "it plays, ends, a beat
// of silence, then restarts". Scans backward from the end (same threshold/
// window as the leading-silence scan) for where real signal actually stops.
function detectTrailingSignalEndSeconds(audioBuffer) {
  const data = audioBuffer.getChannelData(0);
  const scanStart = Math.max(0, data.length - Math.floor(audioBuffer.sampleRate * 0.5));
  for (let i = data.length - 1; i >= scanStart; i--) {
    if (Math.abs(data[i]) > SILENCE_AMPLITUDE_THRESHOLD) {
      return (i + 1) / audioBuffer.sampleRate;
    }
  }
  return audioBuffer.duration;
}

// Loop-start for a take made WITH "Loop recording" (i.e. one that has
// loopDurationSeconds — see useAudioEngine.js's computeLoopTrimSeconds):
// a FIXED offset, not detected from the waveform. The waveform-scan
// approach (detectLeadingSilenceSeconds above) turned out to be the actual
// bug behind a persistent audible pause — a real recording can have quiet
// content (a soft hi-hat tick, sample pre-roll noise) between the true
// silence and the loud downbeat, and the amplitude threshold latched onto
// that quiet content instead of the beat, landing loopStart ~100ms before
// the actual hit. Since recording starts in sync with the count-in (right
// on beat 1), the true answer is simpler: skip only the known, small,
// content-independent MP3 encoder lead-in (LAME's encoder delay is
// ~26ms/1152 samples at 44.1kHz), nothing more.
const FIXED_LOOP_LEAD_IN_SECONDS = 0.03;

const WAVE_BARS = Array.from({ length: 7 });

// Purely decorative — its motion is honestly tied to the real `isRecording`
// state (only animates while actually recording), but the bar heights
// don't reflect real input level. A true level meter would need an
// AnalyserNode on the recording stream, which the native ASIO path
// (Tauri) doesn't expose the same way the browser path does.
function WaveBars({ active }) {
  return (
    <div className={`recording-panel__wave${active ? ' recording-panel__wave--active' : ''}`} aria-hidden="true">
      {WAVE_BARS.map((_, i) => (
        <span key={i} className="recording-panel__wave-bar" style={{ animationDelay: `${i * 0.09}s` }} />
      ))}
    </div>
  );
}

export default function RecordingPanel({
  supported,
  isRecording,
  isSaving,
  recordings,
  bpm,
  timeSignature,
  onToggle,
  onCountInClick,
  onDelete,
  onRename,
  onArchive,
  loopEnabled,
  onLoopEnabledChange,
  syncOffsetMs,
  onSyncOffsetChange,
}) {
  const [count, setCount] = useState(null); // null = no count-in active, otherwise 1..beatsPerBar
  const [elapsedMs, setElapsedMs] = useState(0);
  const startedAtRef = useRef(null);
  // Per-recording playback-loop override (id -> boolean). Defaults to
  // isLoopTake(filename) when a take has no explicit override yet, so
  // "Loop recording" takes actually loop on play without extra clicks,
  // while still letting the user flip it either way per take.
  const [loopPlaybackOverrides, setLoopPlaybackOverrides] = useState({});
  // Gapless loop preview: the native <audio loop> element can't guarantee
  // a click/pause-free restart (browsers don't seek/loop compressed audio
  // sample-accurately), so looped playback that must run with no gap
  // between passes goes through Web Audio's AudioBufferSourceNode instead,
  // which loops at an exact sample position (loopEnd) with no restart gap.
  // loopTrimOverrides (id -> seconds) is the user-adjustable point that
  // sample-accurate loop restarts at; loopStartOverrides (id -> seconds) is
  // the equally user-adjustable point it restarts FROM — both draggable
  // directly on the LoopWaveform below (see handlePointerDown/Move there);
  // naturalDurations (id -> seconds) is each recording's full decoded
  // length, known only once decoded.
  const [loopTrimOverrides, setLoopTrimOverrides] = useState({});
  const [loopStartOverrides, setLoopStartOverrides] = useState({});
  const [naturalDurations, setNaturalDurations] = useState({});
  const [playingLoopId, setPlayingLoopId] = useState(null);
  const previewCtxRef = useRef(null);
  const decodedBuffersRef = useRef({});
  // MP3 encoding (LAME, see useAudioEngine.js's mp3Encode) always pads a
  // short burst of silence onto the very start of the file (encoder
  // filterbank delay, typically ~10-30ms) — decodeAudioData includes it
  // literally, so looping back to sample 0 replays that silence on every
  // pass, which is exactly what's audible as "a pause" at the loop point.
  // Detected once per decoded buffer and used as loopStart (not 0) below,
  // so only the very first play-through ever hits it.
  const leadingSilenceRef = useRef({});
  // The other end of the same silence-padding problem — see
  // detectTrailingSignalEndSeconds's doc above. Used as the DEFAULT trim
  // value (loopTrimOverrides still wins once the user actually touches the
  // stepper) so playback doesn't sit through trailing silence before
  // restarting.
  const trailingSignalEndRef = useRef({});
  // Chained-segment gapless scheduling (same lookahead pattern as
  // Scheduler.js — see LOOP_SCHEDULE_AHEAD_SECONDS's doc below): rather
  // than trusting a single AudioBufferSourceNode's own loop/loopStart/
  // loopEnd wraparound, a new non-looping copy of the same segment is
  // explicitly scheduled to start at the exact audioCtx time the previous
  // one ends, chained indefinitely. Sample-accurate because the start time
  // comes from the audio clock, not a JS timer.
  const loopSchedulerIdRef = useRef(null);
  const loopScheduledSourcesRef = useRef([]);
  const loopNextStartTimeRef = useRef(0);
  const loopSegmentRef = useRef(null); // { buffer, offset, duration }
  const decodingRef = useRef(new Set());
  const audioElementsRef = useRef({}); // id -> <audio> DOM node, so starting one playback stops the other
  // Inline rename of one recording at a time (no native prompt() — see
  // ArrangementEditor.jsx's earlier reasoning: unreliable inside Tauri's
  // webview), keyed by id since the list renders every recording at once,
  // unlike a single-selection dropdown.
  const [renamingId, setRenamingId] = useState(null);
  const [renameText, setRenameText] = useState('');
  const [renameError, setRenameError] = useState('');
  // Archived recordings stay in the list from useAudioEngine.js/
  // useMobileAudioEngine.js's point of view, just hidden here by default —
  // this toggles a separate view to bring one back.
  const [showArchived, setShowArchived] = useState(false);

  const beatsPerBar = beatsPerBarFromTimeSignature(timeSignature);
  const totalCountInBeats = beatsPerBar * COUNT_IN_BARS;
  const beatMs = 60000 / (bpm || 120);

  // One click per counted beat (accent on beat 1 of each bar), then wait
  // beatMs and either advance to the next number or — after the last beat
  // of the second bar — end the count-in and start the actual recording.
  useEffect(() => {
    if (count === null) return undefined;
    onCountInClick?.((count - 1) % beatsPerBar === 0);
    const timer = setTimeout(() => {
      if (count >= totalCountInBeats) {
        setCount(null);
        onToggle();
      } else {
        setCount((c) => c + 1);
      }
    }, beatMs);
    return () => clearTimeout(timer);
  }, [count, beatsPerBar, totalCountInBeats, beatMs, onToggle, onCountInClick]);

  // Real elapsed-time counter, not decorative: starts at 0 the moment
  // recording actually begins, ticks while it's running.
  useEffect(() => {
    if (!isRecording) {
      setElapsedMs(0);
      startedAtRef.current = null;
      return undefined;
    }
    startedAtRef.current = Date.now();
    const interval = setInterval(() => {
      setElapsedMs(Date.now() - startedAtRef.current);
    }, 250);
    return () => clearInterval(interval);
  }, [isRecording]);

  // Global Start/Stop-Recording shortcuts — Right Arrow starts (with the
  // usual count-in), Left Arrow stops. Ignored while the user is typing
  // somewhere (pattern name, BPM field, …) so normal cursor movement in
  // those fields still works; ArrowRight also does nothing once already
  // recording/counting in (it's a start action, not a toggle) and
  // ArrowLeft does nothing while not recording.
  useEffect(() => {
    if (!supported) return undefined;
    function handleKeyDown(e) {
      if (isTextEntryTarget(document.activeElement)) return;
      if (e.key === 'ArrowRight') {
        if (isRecording || count !== null) return;
        e.preventDefault();
        setCount(1);
      } else if (e.key === 'ArrowLeft') {
        if (!isRecording) return;
        e.preventDefault();
        onToggle();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [supported, isRecording, count, onToggle]);

  // Lazily decodes any loop-enabled recording so its full duration is known
  // (the loop-trim stepper needs it as the upper bound, and the "▶ Loop"
  // gapless preview button needs the actual AudioBuffer) — decoding is
  // itself cheap enough at this app's recording sizes to just always do it
  // once a take is marked as looping, rather than waiting for the user to
  // press play. decodingRef guards against re-decoding the same recording
  // twice while its fetch/decode is still in flight.
  useEffect(() => {
    recordings.forEach((r) => {
      const loopPlayback = loopPlaybackOverrides[r.id] ?? isLoopTake(r.filename);
      if (!loopPlayback) return;
      if (naturalDurations[r.id] != null) return;
      if (decodingRef.current.has(r.id)) return;
      decodingRef.current.add(r.id);
      (async () => {
        try {
          if (!previewCtxRef.current) {
            previewCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
          }
          const response = await fetch(r.url);
          const arrayBuffer = await response.arrayBuffer();
          const buffer = await previewCtxRef.current.decodeAudioData(arrayBuffer);
          decodedBuffersRef.current[r.id] = buffer;
          leadingSilenceRef.current[r.id] = detectLeadingSilenceSeconds(buffer);
          trailingSignalEndRef.current[r.id] = detectTrailingSignalEndSeconds(buffer);
          setNaturalDurations((d) => ({ ...d, [r.id]: buffer.duration }));
        } catch (err) {
          console.error('Decoding a recording for gapless loop preview failed:', err);
        } finally {
          decodingRef.current.delete(r.id);
        }
      })();
    });
  }, [recordings, loopPlaybackOverrides, naturalDurations]);

  // Stops the gapless preview (if any) and closes its AudioContext when
  // this panel unmounts, instead of leaving the scheduler/voices dangling.
  useEffect(() => {
    return () => {
      if (loopSchedulerIdRef.current) {
        clearInterval(loopSchedulerIdRef.current);
      }
      loopScheduledSourcesRef.current.forEach((source) => {
        try {
          source.stop();
        } catch {
          // already stopped - nothing to do
        }
      });
      previewCtxRef.current?.close().catch(() => {});
    };
  }, []);

  if (!supported) {
    return (
      <div className="recording-panel recording-panel--unsupported">
        Recording: browser doesn't support MediaRecorder.
      </div>
    );
  }

  function handleToggleClick() {
    if (isRecording) {
      onToggle();
      return;
    }
    if (count !== null) return; // count-in already running
    setCount(1);
  }

  function handleStartRename(r) {
    setRenamingId(r.id);
    setRenameText(baseName(r.filename));
    setRenameError('');
  }

  function handleCancelRename() {
    setRenamingId(null);
    setRenameError('');
  }

  async function handleConfirmRename(e) {
    e.preventDefault();
    const result = await onRename(renamingId, renameText);
    if (!result?.ok) {
      setRenameError(result?.error || 'Renaming failed.');
      return;
    }
    setRenamingId(null);
    setRenameError('');
  }

  function getTrimSeconds(r) {
    const override = loopTrimOverrides[r.id];
    if (override != null) return override;
    // Prefer the EXACT bar-aligned duration computed at record time (see
    // useAudioEngine.js's computeLoopTrimSeconds call) over guessing from
    // the waveform: a drum pattern can legitimately have real silence late
    // in its last bar (e.g. the last hit falls early), and amplitude-based
    // scanning can't tell that apart from encoder padding — trimming it
    // away shifts the loop off the beat grid, which is exactly what a
    // hardware looper never does (it loops the exact number of recorded
    // samples, not a guessed one). Only recordings made without "Loop
    // recording" on (or loaded back after a restart, which can't recover
    // this) fall back to the waveform scan.
    const natural = naturalDurations[r.id];
    if (r.loopDurationSeconds != null && natural != null) {
      return Math.min(FIXED_LOOP_LEAD_IN_SECONDS + r.loopDurationSeconds, natural);
    }
    if (trailingSignalEndRef.current[r.id] != null) return trailingSignalEndRef.current[r.id];
    return natural ?? null;
  }

  // The un-overridden loop-start point a recording would use — same
  // reasoning as getTrimSeconds' fallback chain above, mirrored for the
  // start side: a "Loop recording" take always starts at the fixed
  // encoder-lead-in offset, anything else falls back to the detected
  // leading-silence point.
  function rawLoopStartSeconds(r) {
    return r.loopDurationSeconds != null ? FIXED_LOOP_LEAD_IN_SECONDS : (leadingSilenceRef.current[r.id] ?? 0);
  }

  function getLoopStartSeconds(r) {
    const override = loopStartOverrides[r.id];
    return override != null ? override : rawLoopStartSeconds(r);
  }

  // Shared clamping for both the drag handles on LoopWaveform and the trim
  // NumberStepper below — keeps loopStart/loopEnd from ever crossing each
  // other (a minimum 100ms segment) regardless of which end the user is
  // currently moving.
  function handleLoopStartSecondsChange(r, seconds) {
    const natural = naturalDurations[r.id];
    if (natural == null) return;
    const currentEnd = getTrimSeconds(r) ?? natural;
    const clamped = Math.max(0, Math.min(seconds, currentEnd - 0.1));
    setLoopStartOverrides((o) => ({ ...o, [r.id]: clamped }));
  }

  function handleLoopEndSecondsChange(r, seconds) {
    const natural = naturalDurations[r.id];
    if (natural == null) return;
    const currentStart = getLoopStartSeconds(r);
    const clamped = Math.max(currentStart + 0.1, Math.min(natural, seconds));
    setLoopTrimOverrides((o) => ({ ...o, [r.id]: clamped }));
  }

  // Takes the final value directly (milliseconds, converted to seconds
  // here), matching NumberStepper's onChange contract — its own hold/type-
  // in logic already does the stepping/clamping/rounding.
  function handleTrimMsChange(r, ms) {
    handleLoopEndSecondsChange(r, ms / 1000);
  }

  // Schedules one more non-looping copy of the loop segment right after
  // the previously-scheduled one, using audioCtx time (not Date.now()/JS
  // timers) as the start time — the same reason Scheduler.js's own
  // trigger times are all audioCtx-clock-based. AudioBufferSourceNode's
  // own loop/loopStart/loopEnd wraparound *should* be equally gapless per
  // spec, but chaining explicit segments this way removes any dependency
  // on a single node's own internal loop implementation and matches
  // exactly how this app's drum sequencer already schedules ahead.
  function scheduleNextLoopSegment(ctx) {
    const segment = loopSegmentRef.current;
    if (!segment) return;
    const source = ctx.createBufferSource();
    source.buffer = segment.buffer;
    source.connect(ctx.destination);
    // Prunes itself from the tracking array once done — without this the
    // array would grow for as long as the loop keeps playing (every ~100ms
    // tick can add a new entry that's never removed again).
    source.onended = () => {
      loopScheduledSourcesRef.current = loopScheduledSourcesRef.current.filter((s) => s !== source);
    };
    source.start(loopNextStartTimeRef.current, segment.offset, segment.duration);
    loopScheduledSourcesRef.current.push(source);
    loopNextStartTimeRef.current += segment.duration;
  }

  // Same "tick often, schedule a short window ahead using the audio
  // clock" shape as Scheduler.js's own _scheduler() — keeps the next
  // couple of loop passes queued up well before they're due, so a slow
  // JS tick never risks missing the exact moment the current pass ends.
  const LOOP_SCHEDULE_AHEAD_SECONDS = 0.3;
  const LOOP_SCHEDULE_INTERVAL_MS = 100;
  function loopSchedulerTick() {
    const ctx = previewCtxRef.current;
    if (!ctx || !loopSegmentRef.current) return;
    while (loopNextStartTimeRef.current < ctx.currentTime + LOOP_SCHEDULE_AHEAD_SECONDS) {
      scheduleNextLoopSegment(ctx);
    }
  }

  // The exact {loopStart, loopEnd} a given recording will actually be
  // played with — factored out so LoopWaveform (below) can draw markers at
  // PRECISELY what handlePlayLoopPreview uses, not an approximation of it.
  function computeLoopBounds(r, buffer) {
    // loopStart defaults to rawLoopStartSeconds (never waveform-scanned for
    // a "Loop recording" take — see FIXED_LOOP_LEAD_IN_SECONDS's doc for
    // why that was the bug), but the user can now drag it directly on the
    // LoopWaveform below (see handleLoopStartSecondsChange), same as
    // loopEnd already could via the trim stepper.
    const rawStart = r.loopDurationSeconds != null ? FIXED_LOOP_LEAD_IN_SECONDS : (leadingSilenceRef.current[r.id] ?? 0);
    const defaultEnd =
      r.loopDurationSeconds != null
        ? Math.min(rawStart + r.loopDurationSeconds, buffer.duration)
        : (trailingSignalEndRef.current[r.id] ?? buffer.duration);
    const trim = loopTrimOverrides[r.id] ?? defaultEnd;
    const start = loopStartOverrides[r.id] ?? rawStart;
    const loopStart = Math.max(0, Math.min(start, trim - 0.05));
    const loopEnd = Math.min(Math.max(trim, loopStart + 0.1), buffer.duration);
    return { loopStart, loopEnd };
  }

  // Gapless loop preview: decode once (or reuse the cached buffer from the
  // background-decode effect above), then chain-schedule copies of the
  // trimmed segment back-to-back (see scheduleNextLoopSegment) so there's
  // no restart pause the way the native <audio loop> element can have on
  // compressed audio.
  async function handlePlayLoopPreview(r) {
    stopLoopPreview();
    audioElementsRef.current[r.id]?.pause();
    if (!previewCtxRef.current) {
      previewCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    const ctx = previewCtxRef.current;
    if (ctx.state === 'suspended') await ctx.resume();

    let buffer = decodedBuffersRef.current[r.id];
    if (!buffer) {
      const response = await fetch(r.url);
      const arrayBuffer = await response.arrayBuffer();
      buffer = await ctx.decodeAudioData(arrayBuffer);
      decodedBuffersRef.current[r.id] = buffer;
      leadingSilenceRef.current[r.id] = detectLeadingSilenceSeconds(buffer);
      trailingSignalEndRef.current[r.id] = detectTrailingSignalEndSeconds(buffer);
      setNaturalDurations((d) => ({ ...d, [r.id]: buffer.duration }));
    }

    const { loopStart, loopEnd } = computeLoopBounds(r, buffer);

    loopSegmentRef.current = { buffer, offset: loopStart, duration: loopEnd - loopStart };
    loopScheduledSourcesRef.current = [];
    loopNextStartTimeRef.current = ctx.currentTime + 0.05;
    scheduleNextLoopSegment(ctx);
    scheduleNextLoopSegment(ctx); // pre-queue a second pass immediately, not just on the first tick
    loopSchedulerIdRef.current = setInterval(loopSchedulerTick, LOOP_SCHEDULE_INTERVAL_MS);
    setPlayingLoopId(r.id);
  }

  function stopLoopPreview() {
    if (loopSchedulerIdRef.current) {
      clearInterval(loopSchedulerIdRef.current);
      loopSchedulerIdRef.current = null;
    }
    loopScheduledSourcesRef.current.forEach((source) => {
      try {
        source.stop();
      } catch {
        // already stopped - nothing to do
      }
      try {
        source.disconnect();
      } catch {
        // already disconnected - nothing to do
      }
    });
    loopScheduledSourcesRef.current = [];
    loopSegmentRef.current = null;
    setPlayingLoopId(null);
  }

  const counting = count !== null;

  return (
    <div className="recording-panel">
      <h2 className="drums-section__heading">Recording</h2>
      <div className="recording-panel__row">
        <div className="recording-panel__main">
          {onLoopEnabledChange && (
            <label
              className="guitar-panel__latency-toggle"
              title="Trim the recording to the end of the last full bar, so it loops cleanly"
            >
              <input
                type="checkbox"
                checked={loopEnabled}
                disabled={isRecording || counting}
                onChange={(e) => onLoopEnabledChange(e.target.checked)}
              />
              <svg
                viewBox="0 0 24 24"
                width="13"
                height="13"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ verticalAlign: '-2px', marginRight: '4px' }}
                aria-hidden="true"
              >
                <polyline points="17 1 21 5 17 9" />
                <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                <polyline points="7 23 3 19 7 15" />
                <path d="M21 13v2a4 4 0 0 1-4 4H3" />
              </svg>
              Loop recording
            </label>
          )}
          <WaveBars active={isRecording} />
          <button
            type="button"
            className={[
              'recording-panel__toggle',
              isRecording ? 'recording-panel__toggle--active' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={handleToggleClick}
            disabled={counting}
          >
            <span className="recording-panel__toggle-dot" aria-hidden="true" />
            {isRecording ? 'Stop Recording' : 'Start Recording'}
          </button>
          <WaveBars active={isRecording} />

          {counting && (
            <span className="recording-panel__countdown">{((count - 1) % beatsPerBar) + 1}</span>
          )}

          {isRecording && (
            <div className="recording-panel__timer">
              <span className="recording-panel__timer-time">{formatElapsed(elapsedMs)}</span>
              <button
                type="button"
                className="recording-panel__timer-stop"
                onClick={onToggle}
                aria-label="Stop recording"
                title="Stop recording"
              >
                ■
              </button>
            </div>
          )}
        </div>
      </div>

      {isRecording && (
        <span className="recording-panel__live">
          Recording drums (browser) + guitar/mic (native — includes drums too when a kit's loaded natively) …
        </span>
      )}

      {isSaving && (
        <span className="recording-panel__live">
          Saving your last take — please don't close the app yet …
        </span>
      )}

      {onSyncOffsetChange && (
        <div className="recording-panel__sync">
          <label
            htmlFor="recording-sync-offset"
            title="Shifts the guitar/mic track relative to the drums. Positive = delay guitar/mic (use if it comes in too early); negative = delay the drums instead (use if guitar/mic still comes in too late after the automatic latency compensation)."
          >
            <svg
              viewBox="0 0 24 24"
              width="13"
              height="13"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ verticalAlign: '-2px', marginRight: '4px' }}
              aria-hidden="true"
            >
              <line x1="4" y1="21" x2="4" y2="14" />
              <line x1="4" y1="10" x2="4" y2="3" />
              <line x1="12" y1="21" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12" y2="3" />
              <line x1="20" y1="21" x2="20" y2="16" />
              <line x1="20" y1="12" x2="20" y2="3" />
              <line x1="1" y1="14" x2="7" y2="14" />
              <line x1="9" y1="8" x2="15" y2="8" />
              <line x1="17" y1="16" x2="23" y2="16" />
            </svg>
            Guitar/Mic Sync
          </label>
          <input
            id="recording-sync-offset"
            type="range"
            min={-100}
            max={100}
            step={1}
            value={syncOffsetMs}
            onChange={(e) => onSyncOffsetChange(Number(e.target.value))}
          />
          <span className="recording-panel__sync-value">
            {syncOffsetMs > 0 ? '+' : ''}
            {syncOffsetMs} ms
          </span>
        </div>
      )}

      {(() => {
        const visibleRecordings = recordings.filter((r) => !r.archived);
        const archivedRecordings = recordings.filter((r) => r.archived);
        return (
          <>
            {visibleRecordings.length > 0 && (
              <ul className="recording-panel__list">
                {visibleRecordings.map((r) => {
                  const loopPlayback = loopPlaybackOverrides[r.id] ?? isLoopTake(r.filename);
                  return (
                    <li key={r.id} className="recording-panel__item">
                      <audio
                        ref={(el) => {
                          audioElementsRef.current[r.id] = el;
                        }}
                        controls
                        // Never loops here — the browser can't restart
                        // compressed audio at an exact sample position, so
                        // native looping always has an audible gap/stutter
                        // at the seam. Seamless looping only happens
                        // through the "▶ Loop" Web Audio button below.
                        loop={false}
                        onPlay={stopLoopPreview}
                        src={r.url}
                        className="recording-panel__audio"
                      />
                      <label
                        className="recording-panel__loop-playback"
                        title="Show seamless-loop playback controls for this recording"
                      >
                        <input
                          type="checkbox"
                          checked={loopPlayback}
                          onChange={(e) =>
                            setLoopPlaybackOverrides((o) => ({ ...o, [r.id]: e.target.checked }))
                          }
                        />
                        <svg
                          viewBox="0 0 24 24"
                          width="13"
                          height="13"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <polyline points="17 1 21 5 17 9" />
                          <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                          <polyline points="7 23 3 19 7 15" />
                          <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                        </svg>
                      </label>

                      {loopPlayback && (
                        <>
                          <button
                            type="button"
                            className="recording-panel__delete"
                            onClick={() =>
                              playingLoopId === r.id ? stopLoopPreview() : handlePlayLoopPreview(r)
                            }
                            title="Play this recording seamlessly looped (no restart pause), trimmed to the point below"
                          >
                            {playingLoopId === r.id ? '⏸' : '▶'} Loop
                          </button>
                          {naturalDurations[r.id] != null && (
                            <NumberStepper
                              value={Math.round(getTrimSeconds(r) * 1000)}
                              onChange={(ms) => handleTrimMsChange(r, ms)}
                              min={100}
                              max={Math.round(naturalDurations[r.id] * 1000)}
                              step={10}
                              format={formatMsAsClock}
                              parse={parseClockAsMs}
                              className="recording-panel__loop-trim"
                              ariaLabel={`loop length for ${r.filename}`}
                              title="Trim how much of this recording plays before it loops back to the start (M:SS:cc)"
                            />
                          )}
                          {naturalDurations[r.id] != null &&
                            decodedBuffersRef.current[r.id] &&
                            (() => {
                              const buffer = decodedBuffersRef.current[r.id];
                              const { loopStart, loopEnd } = computeLoopBounds(r, buffer);
                              return (
                                <LoopWaveform
                                  buffer={buffer}
                                  loopStart={loopStart}
                                  loopEnd={loopEnd}
                                  onLoopStartChange={(seconds) => handleLoopStartSecondsChange(r, seconds)}
                                  onLoopEndChange={(seconds) => handleLoopEndSecondsChange(r, seconds)}
                                />
                              );
                            })()}
                        </>
                      )}

                      {r.id === renamingId ? (
                        <form className="recording-panel__rename-form" onSubmit={handleConfirmRename}>
                          <input
                            type="text"
                            className="pattern-manager__name-input"
                            value={renameText}
                            onChange={(e) => setRenameText(e.target.value)}
                            maxLength={80}
                            autoFocus
                          />
                          <button type="submit" className="pattern-manager__save-btn" disabled={!renameText.trim()}>
                            Save
                          </button>
                          <button type="button" className="pattern-manager__save-btn" onClick={handleCancelRename}>
                            Cancel
                          </button>
                          {renameError && <span className="prompt-bar__error">{renameError}</span>}
                        </form>
                      ) : (
                        <>
                          <a href={r.url} download={r.filename} className="recording-panel__download">
                            <svg
                              viewBox="0 0 24 24"
                              width="13"
                              height="13"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              style={{ verticalAlign: '-2px', marginRight: '4px' }}
                              aria-hidden="true"
                            >
                              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                              <polyline points="17 21 17 13 7 13 7 21" />
                              <polyline points="7 3 7 8 15 8" />
                            </svg>
                            {r.filename}
                          </a>
                          {onRename && (
                            <button
                              type="button"
                              className="recording-panel__delete"
                              onClick={() => handleStartRename(r)}
                              title="Rename"
                            >
                              <svg
                                viewBox="0 0 24 24"
                                width="13"
                                height="13"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                style={{ verticalAlign: '-2px', marginRight: '4px' }}
                                aria-hidden="true"
                              >
                                <path d="M12 20h9" />
                                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                              </svg>
                              Rename
                            </button>
                          )}
                          {onArchive && (
                            <button
                              type="button"
                              className="recording-panel__delete"
                              onClick={() => onArchive(r.id, true)}
                              title="Hide from this list without deleting the file"
                            >
                              <svg
                                viewBox="0 0 24 24"
                                width="13"
                                height="13"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                style={{ verticalAlign: '-2px', marginRight: '4px' }}
                                aria-hidden="true"
                              >
                                <rect x="3" y="4" width="18" height="4" rx="1" />
                                <path d="M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8" />
                                <path d="M10 13h4" />
                              </svg>
                              Archive
                            </button>
                          )}
                          <button
                            type="button"
                            className="recording-panel__delete"
                            onClick={async () => {
                              // Every removal is permanent from the user's point of
                              // view, not just the ones backed by a file: mobile and
                              // pure-browser-mode takes only ever exist as an in-memory
                              // blob (no `path`), so there's no Recycle Bin to fall
                              // back on for those either — a stray tap must not be
                              // able to destroy the only copy of a take, on-disk or not.
                              const message = r.path
                                ? `Delete "${r.filename}"? It will be moved to the Recycle Bin.`
                                : `Remove "${r.filename}"? This cannot be undone.`;
                              // window.confirm() is unreliable inside Tauri's native
                              // window on several platforms — it can silently resolve
                              // without ever showing a dialog instead of actually
                              // asking (a known Tauri/webview limitation, not specific
                              // to this app). Use the dialog plugin's own confirm()
                              // there instead — already a dependency of this app (see
                              // NativeGuitarEngine.js's file-open dialog) — and keep
                              // window.confirm() for plain-browser/mobile-web, where it
                              // works fine outside a Tauri window.
                              const confirmed = isTauriRuntime()
                                ? await window.__TAURI__.dialog.confirm(message, {
                                    title: 'Pocket Studio',
                                    kind: 'warning',
                                  })
                                : window.confirm(message);
                              if (!confirmed) return;
                              onDelete(r.id);
                            }}
                            title={r.path ? 'Deletes the file from disk' : 'Remove from the list'}
                          >
                            🗑
                          </button>
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            {onArchive && (archivedRecordings.length > 0 || showArchived) && (
              <div className="recording-panel__archived">
                <label className="guitar-panel__latency-toggle">
                  <input
                    type="checkbox"
                    checked={showArchived}
                    onChange={(e) => setShowArchived(e.target.checked)}
                  />
                  Show archived ({archivedRecordings.length})
                </label>
                {showArchived &&
                  (archivedRecordings.length === 0 ? (
                    <p className="instrument-card__hint">No archived recordings.</p>
                  ) : (
                    <ul className="recording-panel__archived-list">
                      {archivedRecordings.map((r) => (
                        <li key={r.id} className="recording-panel__archived-item">
                          <span className="recording-panel__archived-name">{r.filename}</span>
                          <button
                            type="button"
                            className="pattern-manager__load-btn"
                            onClick={() => onArchive(r.id, false)}
                          >
                            Unarchive
                          </button>
                        </li>
                      ))}
                    </ul>
                  ))}
              </div>
            )}
          </>
        );
      })()}
    </div>
  );
}
