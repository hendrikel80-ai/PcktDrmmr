// Phase 2: real NAM inference in the ASIO callback, plus a post-NAM noise
// gate. Phase 3 adds: input/output gain, a 3-band tone stack (Bass/Mid/
// Treble), and a Freeverb-style reverb — the same knobs GuitarPanel.jsx
// already exposes, previously wired to NativeGuitarEngine.js no-op stubs.
// Builds on Phase 0/1a's proven passthrough (ASIOControlPanel() call,
// prepare_input_stream/prepare_output_stream pairing, mono-to-all-channels
// output routing — see the plan for why each of those is there).
//
// Signal chain per block: input gain -> NAM (or passthrough if no model
// loaded) -> tone stack -> noise gate -> reverb -> output gain -> every
// output channel. Gate sits before reverb so it cleans the dry signal
// without chopping the reverb tail (the reverb's own internal feedback
// state keeps ringing after its input goes quiet, same as a real
// pedal/rack unit).
//
// Model loading (nam_ffi::NamModel::load) does file I/O + JSON parsing and
// must never run on the audio thread. It's called from the load_model
// Tauri command (which runs on Tauri's async command thread, not the ASIO
// callback thread), then swapped into a Mutex<Option<NamModel>> shared
// with the callback. This is a simpler, more pragmatic version of the
// plan's originally-recommended lock-free rtrb handoff: the callback takes
// a plain blocking lock every block (same pattern already used for
// driver.streams(), see Phase 0/1a) rather than a dedicated ring buffer.
// Contention only happens during the rare moment a model is swapped, so a
// brief bounded wait there is preferable to the added complexity, at least
// for this first working version — revisit if it ever causes an audible
// glitch on load.
//
// Gain/EQ/reverb parameters are plain atomics (f32 bits in an AtomicU32),
// per the plan — simpler than a ring buffer for single scalar values, read
// once per block (not per sample; a few hundred microseconds of staleness
// on a knob turn is inaudible, and recomputing biquad coefficients from a
// dB value is cheap enough to just do every block rather than add change
// detection).

use crate::delay::Delay;
use crate::eq::ToneStack;
use crate::nam_ffi::NamModel;
use crate::noise_gate::NoiseGate;
use crate::reverb::Reverb;
use crate::tuner::{self, TunerReading, TUNER_WINDOW_SIZE};
use asio_sys::{Asio, CallbackInfo};
use serde::Serialize;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::mpsc;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{SystemTime, UNIX_EPOCH};

// Post-FX guitar+mic audio capture for the recording tap: the native
// chain renders straight to hardware output and never touches the
// browser's Web Audio graph, so without this a riff recording would
// silently contain drums only. Written straight to a WAV file by a
// dedicated background thread (see the thread spawned in `start()`) —
// NOT fed into the browser's MediaRecorder/Web Audio graph. An earlier
// version did exactly that (chunking captured audio into a stream of
// AudioBufferSourceNodes scheduled into a MediaStreamAudioDestinationNode
// MediaRecorder was capturing) and caused persistent audible crackling in
// the finished recordings — MediaRecorder doesn't tolerate a constant
// stream of freshly-created short buffers being spliced into its source
// well, no matter how precisely their scheduling was computed. Writing
// sequentially to a file sidesteps that whole class of problem: samples
// are appended in arrival order, which is inherently correct since this
// callback runs strictly sequentially in real time — no timing/scheduling
// math needed at all on the write side.
//
// Chunk size is a tradeoff between channel-message frequency and pool
// size; ~46ms @ 44100Hz is a reasonable middle ground. Pool sized
// generously so a slow writer-thread tick (e.g. briefly blocked on file
// I/O) doesn't starve the audio thread of a free buffer to write into.
const GUITAR_CHUNK_SIZE: usize = 2048;
const GUITAR_POOL_SIZE: usize = 8;

/// Sent from the audio callback to the background WAV-writer thread (see
/// `start()`). `EndTake` finalizes/closes the current file — sent once
/// per recording_active true->false transition, detected in the callback.
enum GuitarAudioMsg {
    Batch(Vec<f32>),
    EndTake,
}

unsafe extern "C" {
    #[link_name = "?ASIOControlPanel@@YAJXZ"]
    fn ASIOControlPanel() -> i32;
}

/// Live-adjustable guitar chain parameters, shared between the Tauri
/// commands (writers, off the audio thread) and the ASIO callback
/// (reader, every block). See module doc for why plain atomics are fine
/// here.
pub struct GuitarParams {
    input_gain: AtomicU32,
    output_gain: AtomicU32,
    bass_db: AtomicU32,
    mid_db: AtomicU32,
    treble_db: AtomicU32,
    reverb_wet: AtomicU32,
    delay_enabled: AtomicBool,
    delay_wet: AtomicU32,
    tuner_enabled: AtomicBool,
    recording_active: AtomicBool,
    mic_enabled: AtomicBool,
    mic_gain: AtomicU32,
    mic_reverb_wet: AtomicU32,
}

fn load_f32(a: &AtomicU32) -> f32 {
    f32::from_bits(a.load(Ordering::Relaxed))
}

fn store_f32(a: &AtomicU32, v: f32) {
    a.store(v.to_bits(), Ordering::Relaxed);
}

impl GuitarParams {
    fn new() -> Arc<Self> {
        Arc::new(GuitarParams {
            input_gain: AtomicU32::new(1.0f32.to_bits()),
            output_gain: AtomicU32::new(1.0f32.to_bits()),
            bass_db: AtomicU32::new(0.0f32.to_bits()),
            mid_db: AtomicU32::new(0.0f32.to_bits()),
            treble_db: AtomicU32::new(0.0f32.to_bits()),
            reverb_wet: AtomicU32::new(0.15f32.to_bits()),
            delay_enabled: AtomicBool::new(false),
            delay_wet: AtomicU32::new(0.3f32.to_bits()),
            tuner_enabled: AtomicBool::new(false),
            recording_active: AtomicBool::new(false),
            mic_enabled: AtomicBool::new(false),
            mic_gain: AtomicU32::new(1.0f32.to_bits()),
            mic_reverb_wet: AtomicU32::new(0.15f32.to_bits()),
        })
    }
}

pub struct AsioSession {
    driver: asio_sys::Driver,
    nam_model: Arc<Mutex<Option<NamModel>>>,
    params: Arc<GuitarParams>,
    sample_rate: f64,
    buffer_size: usize,
    latest_tuner_reading: Arc<Mutex<Option<TunerReading>>>,
    latest_native_recording_path: Arc<Mutex<Option<PathBuf>>>,
}

pub struct AsioState(pub Mutex<Option<AsioSession>>);

impl Default for AsioState {
    fn default() -> Self {
        AsioState(Mutex::new(None))
    }
}

#[derive(Serialize)]
pub struct ModelInfo {
    #[serde(rename = "expectedSampleRate")]
    pub expected_sample_rate: f64,
    #[serde(rename = "numInputChannels")]
    pub num_input_channels: i32,
    #[serde(rename = "numOutputChannels")]
    pub num_output_channels: i32,
    #[serde(rename = "hasLoudness")]
    pub has_loudness: bool,
    pub loudness: f64,
}

pub fn list_device_names() -> Vec<String> {
    Asio::new().driver_names()
}

pub fn start(state: &AsioState, recordings_dir: PathBuf) -> Result<String, String> {
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    if guard.is_some() {
        return Ok("already running".to_string());
    }

    let asio = Asio::new();
    let driver_names = asio.driver_names();
    let driver_name = driver_names
        .iter()
        .find(|n| {
            let lower = n.to_lowercase();
            lower.contains("focusrite") && lower.contains("usb")
        })
        .or_else(|| driver_names.iter().find(|n| n.to_lowercase().contains("focusrite")))
        .cloned()
        .ok_or_else(|| format!("no ASIO driver found among: {driver_names:?}"))?;

    let driver = asio.load_driver(&driver_name).map_err(|e| e.to_string())?;
    let channels = driver.channels().map_err(|e| e.to_string())?;
    let num_in = channels.ins as usize;
    let num_out = channels.outs as usize;
    let sample_rate = driver.sample_rate().map_err(|e| e.to_string())?;

    // See Phase 0 in the plan: this driver stays silent without this call,
    // despite every ASIO call otherwise reporting success.
    unsafe {
        ASIOControlPanel();
    }

    let after_input = driver
        .prepare_input_stream(None, num_in, None)
        .map_err(|e| e.to_string())?;
    let input_stream = after_input
        .input
        .ok_or_else(|| "no input stream returned".to_string())?;
    let both = driver
        .prepare_output_stream(Some(input_stream), num_out, None)
        .map_err(|e| e.to_string())?;

    let buffer_size = both
        .output
        .as_ref()
        .ok_or_else(|| "no output stream returned".to_string())?
        .buffer_size as usize;

    {
        let shared = driver.streams();
        let mut streams_guard = shared.lock().map_err(|e| e.to_string())?;
        *streams_guard = both;
    }

    let streams_for_callback = driver.streams();
    let nam_model: Arc<Mutex<Option<NamModel>>> = Arc::new(Mutex::new(None));
    let nam_model_for_callback = nam_model.clone();
    let params = GuitarParams::new();
    let params_for_callback = params.clone();
    // Tuner: the correlation search is too expensive for the audio thread
    // (see tuner.rs's module doc). The callback only ever does a cheap
    // sample copy into a pooled buffer via try_send/try_recv (never
    // blocks, never allocates); a dedicated background thread does the
    // actual analysis and publishes results into latest_tuner_reading.
    let latest_tuner_reading: Arc<Mutex<Option<TunerReading>>> = Arc::new(Mutex::new(None));
    let latest_tuner_reading_for_bg = latest_tuner_reading.clone();
    let (tuner_full_tx, tuner_full_rx) = mpsc::sync_channel::<Vec<f32>>(1);
    let (tuner_free_tx, tuner_free_rx) = mpsc::sync_channel::<Vec<f32>>(2);
    let _ = tuner_free_tx.send(vec![0.0f32; TUNER_WINDOW_SIZE]);
    let _ = tuner_free_tx.send(vec![0.0f32; TUNER_WINDOW_SIZE]);
    let tuner_free_tx_for_callback = tuner_free_tx.clone();
    thread::spawn(move || {
        for buf in tuner_full_rx.iter() {
            if let Some(reading) = tuner::analyze(&buf, sample_rate) {
                if let Ok(mut g) = latest_tuner_reading_for_bg.lock() {
                    *g = Some(reading);
                }
            }
            let _ = tuner_free_tx.send(buf);
        }
    });

    // Recording tap: same pooled-buffer/non-blocking-channel shape as the
    // tuner above, but the payload goes to a WAV-writing background
    // thread instead of an analysis one — see module doc.
    let (guitar_audio_tx, guitar_audio_rx) = mpsc::sync_channel::<GuitarAudioMsg>(GUITAR_POOL_SIZE);
    let (guitar_free_tx, guitar_free_rx) = mpsc::sync_channel::<Vec<f32>>(GUITAR_POOL_SIZE);
    for _ in 0..GUITAR_POOL_SIZE {
        let _ = guitar_free_tx.send(vec![0.0f32; GUITAR_CHUNK_SIZE]);
    }
    let guitar_free_tx_for_callback = guitar_free_tx.clone();
    let guitar_free_tx_for_writer = guitar_free_tx.clone();

    let latest_native_recording_path: Arc<Mutex<Option<PathBuf>>> = Arc::new(Mutex::new(None));
    let latest_native_recording_path_for_writer = latest_native_recording_path.clone();

    thread::spawn(move || {
        let mut writer: Option<hound::WavWriter<std::io::BufWriter<std::fs::File>>> = None;
        let mut current_path: Option<PathBuf> = None;
        for msg in guitar_audio_rx.iter() {
            match msg {
                GuitarAudioMsg::Batch(samples) => {
                    if writer.is_none() {
                        let millis = SystemTime::now()
                            .duration_since(UNIX_EPOCH)
                            .map(|d| d.as_millis())
                            .unwrap_or(0);
                        let path = recordings_dir
                            .join(format!("pocket-studio-riff-{millis}-gitarre-mic.wav"));
                        let spec = hound::WavSpec {
                            channels: 1,
                            sample_rate: sample_rate as u32,
                            bits_per_sample: 32,
                            sample_format: hound::SampleFormat::Float,
                        };
                        match hound::WavWriter::create(&path, spec) {
                            Ok(w) => {
                                writer = Some(w);
                                current_path = Some(path);
                            }
                            Err(e) => {
                                log::error!("failed to create native recording wav file: {e}");
                            }
                        }
                    }
                    if let Some(w) = writer.as_mut() {
                        for &s in &samples {
                            let _ = w.write_sample(s);
                        }
                    }
                    let mut buf = samples;
                    buf.clear();
                    buf.resize(GUITAR_CHUNK_SIZE, 0.0);
                    let _ = guitar_free_tx_for_writer.send(buf);
                }
                GuitarAudioMsg::EndTake => {
                    if let Some(w) = writer.take() {
                        let _ = w.finalize();
                    }
                    if let Some(path) = current_path.take() {
                        if let Ok(mut latest) = latest_native_recording_path_for_writer.lock() {
                            *latest = Some(path);
                        }
                    }
                }
            }
        }
    });

    // Guitar is on input channel 1 (confirmed repeatedly during Phase 0).
    const GUITAR_IN_CH: usize = 1;
    // The Scarlett Solo has exactly one other input (its dedicated mic
    // preamp) — inferred by elimination on a 2-in interface, not directly
    // confirmed by ear the way GUITAR_IN_CH was. If vocals come out on the
    // wrong channel (or silent) on a different interface, this is the
    // first thing to check.
    const MIC_IN_CH: usize = 0;

    // Owned by the callback closure directly (not shared/Mutex'd) — only
    // the ASIO callback thread ever touches these, serially, one block at
    // a time. Pre-allocated once here so the callback itself never
    // allocates.
    let mut scratch_in = vec![0.0f32; buffer_size];
    let mut scratch_out = vec![0.0f32; buffer_size];
    let mut scratch_mic = vec![0.0f32; buffer_size];
    let mut gate = NoiseGate::new(sample_rate);
    let mut tone_stack = ToneStack::new(sample_rate);
    let mut delay = Delay::new(sample_rate);
    let mut reverb = Reverb::new(sample_rate);
    // Independent gate/reverb instances (own state, not shared with the
    // guitar chain above) — a mic's noise floor and room character are
    // unrelated to the guitar's. Same Reverb type/tuning as the guitar
    // (see reverb.rs's module doc for why it's damped rather than bright/
    // metallic-sounding), just its own wet level and internal state.
    let mut mic_gate = NoiseGate::new(sample_rate);
    let mut mic_reverb = Reverb::new(sample_rate);

    // Owned solely by the audio thread across callbacks, like the DSP
    // state above — accumulation position within the currently-checked-out
    // pooled buffer (None when no buffer is checked out).
    let mut tuner_buf: Option<Vec<f32>> = None;
    let mut tuner_pos: usize = 0;
    let mut guitar_chunk: Option<Vec<f32>> = None;
    let mut guitar_chunk_pos: usize = 0;
    // Tracks the recording_active false->true/true->false edge so
    // GuitarAudioMsg::EndTake fires exactly once per take, telling the
    // writer thread to finalize/close the WAV file.
    let mut was_recording_active = false;

    driver.add_callback(move |info: &CallbackInfo| {
        let idx = info.buffer_index as usize;
        let mut guard = match streams_for_callback.lock() {
            Ok(g) => g,
            Err(_) => return,
        };
        if guard.input.is_none() || guard.output.is_none() {
            return;
        }
        let asio_sys::AsioStreams { input, output } = &mut *guard;
        let (input, output) = match (input.as_ref(), output.as_mut()) {
            (Some(i), Some(o)) => (i, o),
            _ => return,
        };
        if GUITAR_IN_CH >= num_in {
            return;
        }

        let input_gain = load_f32(&params_for_callback.input_gain);
        let output_gain = load_f32(&params_for_callback.output_gain);
        let bass_db = load_f32(&params_for_callback.bass_db);
        let mid_db = load_f32(&params_for_callback.mid_db);
        let treble_db = load_f32(&params_for_callback.treble_db);
        let reverb_wet = load_f32(&params_for_callback.reverb_wet);
        let delay_enabled = params_for_callback.delay_enabled.load(Ordering::Relaxed);
        let delay_wet = load_f32(&params_for_callback.delay_wet);
        let tuner_enabled = params_for_callback.tuner_enabled.load(Ordering::Relaxed);
        let recording_active = params_for_callback.recording_active.load(Ordering::Relaxed);
        let mic_enabled = params_for_callback.mic_enabled.load(Ordering::Relaxed);
        let mic_gain = load_f32(&params_for_callback.mic_gain);
        let mic_reverb_wet = load_f32(&params_for_callback.mic_reverb_wet);

        let in_ptr = input.buffer_infos[GUITAR_IN_CH].buffers[idx] as *const i32;
        let in_slice = unsafe { std::slice::from_raw_parts(in_ptr, buffer_size) };
        for (dst, &src) in scratch_in.iter_mut().zip(in_slice) {
            *dst = (src as f32 / i32::MAX as f32) * input_gain;
        }

        // Vocal mic: independent input channel, own gain and gate, mixed
        // straight into the final guitar mix further down — no NAM/EQ/
        // delay/reverb (that chain is guitar-amp modeling, not what a
        // voice needs). Skipped entirely while disabled, both to save the
        // (tiny) processing cost and so an unplugged/muted mic channel
        // can't leak hum/hiss into the mix by default.
        if mic_enabled && MIC_IN_CH < num_in {
            let mic_ptr = input.buffer_infos[MIC_IN_CH].buffers[idx] as *const i32;
            let mic_slice = unsafe { std::slice::from_raw_parts(mic_ptr, buffer_size) };
            for (dst, &src) in scratch_mic.iter_mut().zip(mic_slice) {
                *dst = (src as f32 / i32::MAX as f32) * mic_gain;
            }
            mic_gate.process(&mut scratch_mic);
            mic_reverb.set_wet(mic_reverb_wet);
            mic_reverb.process(&mut scratch_mic);
        } else {
            scratch_mic.iter_mut().for_each(|s| *s = 0.0);
        }

        // Pitch tracking runs on the clean, pre-NAM/pre-FX signal. Only a
        // cheap copy happens here — see the tuner_full_tx/tuner_free_rx
        // setup above for why the actual analysis is off-thread.
        if tuner_enabled {
            if tuner_buf.is_none() {
                tuner_buf = tuner_free_rx.try_recv().ok();
                tuner_pos = 0;
            }
            if let Some(buf) = tuner_buf.as_mut() {
                let n = (buf.len() - tuner_pos).min(scratch_in.len());
                buf[tuner_pos..tuner_pos + n].copy_from_slice(&scratch_in[..n]);
                tuner_pos += n;
                if tuner_pos >= buf.len() {
                    if let Some(full) = tuner_buf.take() {
                        let _ = tuner_full_tx.try_send(full);
                    }
                    tuner_pos = 0;
                }
            }
        } else if let Some(buf) = tuner_buf.take() {
            let _ = tuner_free_tx_for_callback.try_send(buf);
            tuner_pos = 0;
        }

        {
            let mut model_guard = match nam_model_for_callback.lock() {
                Ok(g) => g,
                Err(_) => return,
            };
            match model_guard.as_mut() {
                Some(model) => model.process(&scratch_in, &mut scratch_out),
                None => scratch_out.copy_from_slice(&scratch_in),
            }
        }

        tone_stack.set_gains_db(bass_db, mid_db, treble_db);
        tone_stack.process(&mut scratch_out);

        gate.process(&mut scratch_out);

        delay.set_enabled(delay_enabled);
        delay.set_wet(delay_wet);
        delay.process(&mut scratch_out);

        reverb.set_wet(reverb_wet);
        reverb.process(&mut scratch_out);

        // Apply output gain, then mix in the mic (already gain/gate-
        // processed above, at its own independent level — not affected by
        // the guitar's output_gain), so scratch_out ends up holding the
        // exact final combined signal once, for both the output loop below
        // and the recording-tap capture — it's what actually reaches the
        // speakers, just not yet hardware-integer-encoded.
        //
        // Soft-clip (tanh) instead of a hard clamp: guitar and mic are
        // each independently gain-staged and can each individually sit
        // well under full scale, yet their SUM briefly exceed it whenever
        // both are loud at once (e.g. singing while playing) — a hard
        // clamp there slices the waveform off abruptly, which is exactly
        // what reads as an audible "crackle"/click on transients. tanh
        // compresses peaks smoothly instead (same technique already used
        // for the browser amp-sim's distortion curve, see
        // docs/guitar-ampsim.md), only meaningfully coloring the signal
        // once it's actually pushing toward the ceiling — normal-level
        // signal passes through close to unchanged (tanh(x)≈x for small x).
        for (o, &m) in scratch_out.iter_mut().zip(scratch_mic.iter()) {
            *o = (*o * output_gain + m).tanh();
        }

        // Recording tap: writes straight to a WAV file on a background
        // thread (see module doc / the thread spawned in start()) — no
        // scheduling/timing math needed here, just append in arrival
        // order. Cheap copy into a pooled buffer, same shape as the tuner
        // above; try_send never blocks the audio thread.
        if recording_active {
            if guitar_chunk.is_none() {
                guitar_chunk = guitar_free_rx.try_recv().ok();
                guitar_chunk_pos = 0;
            }
            if let Some(buf) = guitar_chunk.as_mut() {
                let n = (buf.len() - guitar_chunk_pos).min(scratch_out.len());
                buf[guitar_chunk_pos..guitar_chunk_pos + n].copy_from_slice(&scratch_out[..n]);
                guitar_chunk_pos += n;
                if guitar_chunk_pos >= buf.len() {
                    if let Some(full) = guitar_chunk.take() {
                        let _ = guitar_audio_tx.try_send(GuitarAudioMsg::Batch(full));
                    }
                    guitar_chunk_pos = 0;
                }
            }
        } else {
            if let Some(buf) = guitar_chunk.take() {
                let _ = guitar_free_tx_for_callback.try_send(buf);
            }
            guitar_chunk_pos = 0;
            if was_recording_active {
                // Just stopped this block: tell the writer thread the
                // take ended so it finalizes/closes the WAV file.
                let _ = guitar_audio_tx.try_send(GuitarAudioMsg::EndTake);
            }
        }
        was_recording_active = recording_active;

        for ch in 0..num_out {
            let out_ptr = output.buffer_infos[ch].buffers[idx] as *mut i32;
            let out_slice = unsafe { std::slice::from_raw_parts_mut(out_ptr, buffer_size) };
            for (dst, &src) in out_slice.iter_mut().zip(scratch_out.iter()) {
                *dst = (src * i32::MAX as f32) as i32;
            }
        }
    });

    driver.start().map_err(|e| e.to_string())?;

    let msg = format!(
        "started on '{driver_name}', {num_in} in / {num_out} out, buffer {buffer_size} samples"
    );
    *guard = Some(AsioSession {
        driver,
        nam_model,
        params,
        sample_rate,
        buffer_size,
        latest_tuner_reading,
        latest_native_recording_path,
    });
    Ok(msg)
}

pub fn stop(state: &AsioState) -> Result<String, String> {
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    match guard.take() {
        Some(session) => {
            session.driver.stop().map_err(|e| e.to_string())?;
            Ok("stopped".to_string())
        }
        None => Ok("was not running".to_string()),
    }
}

/// Loads a .nam model from an absolute filesystem path. Must be called
/// with an active session (start() first). The (potentially slow) file
/// read/JSON parse/Reset() happens here, off the audio thread, before the
/// quick swap into the shared slot the callback reads.
pub fn load_model(state: &AsioState, path: &str) -> Result<ModelInfo, String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let session = guard
        .as_ref()
        .ok_or_else(|| "not connected — call start_passthrough first".to_string())?;

    let model = NamModel::load(path, session.sample_rate, session.buffer_size as i32)?;
    let info = ModelInfo {
        expected_sample_rate: model.expected_sample_rate,
        num_input_channels: model.num_input_channels,
        num_output_channels: model.num_output_channels,
        has_loudness: model.has_loudness,
        loudness: model.loudness,
    };

    let mut model_guard = session.nam_model.lock().map_err(|e| e.to_string())?;
    *model_guard = Some(model);
    Ok(info)
}

fn with_params<F: FnOnce(&GuitarParams)>(state: &AsioState, f: F) -> Result<(), String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let session = guard
        .as_ref()
        .ok_or_else(|| "not connected — call start_passthrough first".to_string())?;
    f(&session.params);
    Ok(())
}

pub fn set_input_gain(state: &AsioState, value: f32) -> Result<(), String> {
    with_params(state, |p| store_f32(&p.input_gain, value))
}

pub fn set_output_gain(state: &AsioState, value: f32) -> Result<(), String> {
    with_params(state, |p| store_f32(&p.output_gain, value))
}

pub fn set_bass(state: &AsioState, db: f32) -> Result<(), String> {
    with_params(state, |p| store_f32(&p.bass_db, db))
}

pub fn set_mid(state: &AsioState, db: f32) -> Result<(), String> {
    with_params(state, |p| store_f32(&p.mid_db, db))
}

pub fn set_treble(state: &AsioState, db: f32) -> Result<(), String> {
    with_params(state, |p| store_f32(&p.treble_db, db))
}

pub fn set_reverb(state: &AsioState, amount: f32) -> Result<(), String> {
    with_params(state, |p| store_f32(&p.reverb_wet, amount))
}

pub fn set_delay_enabled(state: &AsioState, enabled: bool) -> Result<(), String> {
    with_params(state, |p| p.delay_enabled.store(enabled, Ordering::Relaxed))
}

pub fn set_delay(state: &AsioState, amount: f32) -> Result<(), String> {
    with_params(state, |p| store_f32(&p.delay_wet, amount))
}

pub fn set_tuner_enabled(state: &AsioState, enabled: bool) -> Result<(), String> {
    with_params(state, |p| p.tuner_enabled.store(enabled, Ordering::Relaxed))
}

/// Polled from the JS side while the tuner is on (see GuitarPanel.jsx).
/// Returns the most recent confident reading the callback produced, or
/// None if the buffer hasn't filled yet or the signal was too quiet/
/// ambiguous to call a pitch — not an error, just "nothing to show yet".
pub fn get_tuner_reading(state: &AsioState) -> Result<Option<TunerReading>, String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let session = guard
        .as_ref()
        .ok_or_else(|| "not connected — call start_passthrough first".to_string())?;
    let reading_guard = session.latest_tuner_reading.lock().map_err(|e| e.to_string())?;
    Ok(reading_guard.clone())
}

/// Turns the recording-tap capture on/off (see module doc). Called from
/// the JS side's recording start/stop, mirroring Recorder.js's own
/// start()/stop() calls.
pub fn set_recording_active(state: &AsioState, active: bool) -> Result<(), String> {
    with_params(state, |p| p.recording_active.store(active, Ordering::Relaxed))
}

/// Enables/disables the vocal mic input (see MIC_IN_CH in the callback).
/// Off by default so an unplugged/unused mic channel never leaks hum or
/// hiss into the mix — same reasoning as tuner_enabled gating the pitch
/// search.
pub fn set_mic_enabled(state: &AsioState, enabled: bool) -> Result<(), String> {
    with_params(state, |p| p.mic_enabled.store(enabled, Ordering::Relaxed))
}

pub fn set_mic_gain(state: &AsioState, value: f32) -> Result<(), String> {
    with_params(state, |p| store_f32(&p.mic_gain, value))
}

pub fn set_mic_reverb(state: &AsioState, amount: f32) -> Result<(), String> {
    with_params(state, |p| store_f32(&p.mic_reverb_wet, amount))
}

/// Path of the most recently finished native (guitar+mic) WAV recording,
/// if any — polled once by JS right after stopping a take (see
/// NativeGuitarEngine.js). Finalizing happens asynchronously on the
/// writer thread (see `start()`), not synchronously with
/// set_recording_active(false), so this can briefly still report the
/// *previous* take's path (or None, before the very first take of the
/// session finishes) right after stopping — callers should poll a couple
/// of times with a short delay rather than treat a miss as an error.
pub fn get_last_native_recording_path(state: &AsioState) -> Result<Option<String>, String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let session = guard
        .as_ref()
        .ok_or_else(|| "not connected — call start_passthrough first".to_string())?;
    let path_guard = session
        .latest_native_recording_path
        .lock()
        .map_err(|e| e.to_string())?;
    Ok(path_guard.as_ref().map(|p| p.to_string_lossy().into_owned()))
}
