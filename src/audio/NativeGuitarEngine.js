// Drives the real native ASIO + NAM signal chain (src-tauri/src/
// asio_engine.rs) via Tauri IPC instead of Web Audio nodes. Mirrors
// GuitarEngine.js's public method surface so GuitarPanel.jsx/
// useAudioEngine.js don't need to know which one they're driving.
//
// Unlike GuitarEngine.js, this never touches the browser's AudioContext/
// masterOut at all — the native audio path is a separate signal chain
// that only combines with the browser's drum output at the physical
// audio hardware (ASIO + WASAPI multi-client), exactly like the existing
// Reaper+browser split already does today.

export class NativeGuitarEngine {
  constructor() {
    this.connected = false;
    this.modelInfo = null;
  }

  static isSupported() {
    return typeof window !== 'undefined' && '__TAURI__' in window;
  }

  get isConnected() {
    return this.connected;
  }

  async listInputDevices() {
    const names = await window.__TAURI__.core.invoke('list_devices');
    return names.map((name) => ({ id: name, name }));
  }

  async connectInput() {
    // deviceId not used yet — the Rust side always picks the Focusrite
    // USB ASIO driver (see asio_engine.rs); device selection is Phase 3.
    await window.__TAURI__.core.invoke('start_passthrough');
    this.connected = true;
  }

  // Must be awaited before the UI treats the guitar as disconnected — the
  // Rust side tears the ASIO stream down synchronously (ASIOStop,
  // ASIODisposeBuffers, ASIOExit) inside this call, so as long as callers
  // wait for it, a subsequent connectInput() can never race ahead of it.
  // An earlier fire-and-forget version flipped `connected` immediately,
  // which let a quick reconnect fire start_passthrough before Tauri had
  // even dispatched the pending stop_passthrough — since Tauri doesn't
  // guarantee command execution order across separate invokes, the stale
  // stop could then land AFTER the new session was created and tear that
  // one down instead, leaving a corrupted mix (the exact symptoms this
  // was fixed for: guitar audio not actually stopping, mic silent
  // afterward, audible noise, gate seemingly not working).
  async disconnectInput() {
    await window.__TAURI__.core.invoke('stop_passthrough');
    this.connected = false;
  }

  // Opens the native file picker (real filesystem path, unlike a browser
  // <input type="file"> blob — the Rust side reads the file directly) and
  // loads whatever .nam file the user picks. Returns model metadata, or
  // null if the user cancelled the dialog.
  //
  // Known issue on this machine: tauri-plugin-dialog's blocking_pick_file()
  // sometimes returns None on the Rust side even after confirming a file
  // in the picker (Windows/rfd-specific — not something wrong in our own
  // code, verified by reading the plugin's own command implementation).
  // loadModelFromPath() below is the fallback for when this happens.
  async pickAndLoadModel() {
    const result = await window.__TAURI__.dialog.open({
      multiple: false,
      directory: false,
      filters: [{ name: 'NAM-Modell', extensions: ['nam'] }],
    });
    const path = typeof result === 'string' ? result : (result?.path ?? (Array.isArray(result) ? result[0] : null));
    if (!path) {
      throw new Error('Kein Dateipfad vom Dialog erhalten — nutze stattdessen das Pfad-Textfeld.');
    }
    return this.loadModelFromPath(path);
  }

  // Loads a .nam file given its full filesystem path directly, bypassing
  // the native file picker entirely (see pickAndLoadModel's note above).
  async loadModelFromPath(path) {
    const info = await window.__TAURI__.core.invoke('load_model', { path });
    this.modelInfo = { name: path.split(/[\\/]/).pop(), ...info };
    return this.modelInfo;
  }

  // All of these are fire-and-forget: the Rust side just stores the value
  // in an atomic the audio callback reads every block (see
  // asio_engine.rs's GuitarParams) — no need to await a response before
  // the UI moves on. Errors (e.g. calling before connectInput()) are
  // logged, not thrown, so a fast slider drag never surfaces a wall of
  // rejected-promise noise.
  setInputGain(value) {
    window.__TAURI__.core.invoke('set_input_gain', { value }).catch(console.error);
  }

  setOutputGain(value) {
    window.__TAURI__.core.invoke('set_output_gain', { value }).catch(console.error);
  }

  setBass(db) {
    window.__TAURI__.core.invoke('set_bass', { db }).catch(console.error);
  }

  setMid(db) {
    window.__TAURI__.core.invoke('set_mid', { db }).catch(console.error);
  }

  setTreble(db) {
    window.__TAURI__.core.invoke('set_treble', { db }).catch(console.error);
  }

  setReverb(amount) {
    window.__TAURI__.core.invoke('set_reverb', { amount }).catch(console.error);
  }

  setDelayEnabled(enabled) {
    window.__TAURI__.core.invoke('set_delay_enabled', { enabled }).catch(console.error);
  }

  setDelay(amount) {
    window.__TAURI__.core.invoke('set_delay', { amount }).catch(console.error);
  }

  setTunerEnabled(enabled) {
    window.__TAURI__.core.invoke('set_tuner_enabled', { enabled }).catch(console.error);
  }

  // Polled from useAudioEngine.js while the tuner is on. Returns null both
  // on "nothing detected yet" and on any IPC error — a transient failure
  // here shouldn't spam the console every ~100ms.
  async getTunerReading() {
    try {
      return await window.__TAURI__.core.invoke('get_tuner_reading');
    } catch (err) {
      console.error('get_tuner_reading failed:', err);
      return null;
    }
  }

  // Recording tap: the native chain renders straight to hardware output
  // and never touches the browser's Web Audio graph, so guitar+mic get
  // written straight to a WAV file by a background thread on the Rust
  // side (see asio_engine.rs's module doc) instead of going through the
  // browser's MediaRecorder — an earlier version fed captured audio into
  // Web Audio as a stream of scheduled buffers for MediaRecorder to
  // capture, which caused persistent audible crackling in the finished
  // recordings that survived several rounds of scheduling-precision
  // fixes; writing directly to a file sidesteps that whole problem.
  setRecordingActive(active) {
    window.__TAURI__.core.invoke('set_guitar_recording_active', { active }).catch(console.error);
  }

  // Call once after stopping a take. Finalizing the WAV file happens
  // asynchronously on the writer thread, not synchronously with
  // setRecordingActive(false), so this retries a few times with a short
  // delay rather than treating an immediate miss as "no recording
  // happened" — see asio_engine.rs's get_last_native_recording_path.
  async getLastRecordingPath() {
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        const path = await window.__TAURI__.core.invoke('get_last_native_recording_path');
        if (path) return path;
      } catch (err) {
        console.error('get_last_native_recording_path failed:', err);
        return null;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return null;
  }

  // Vocal mic — a second input channel on the same audio interface (see
  // MIC_IN_CH in asio_engine.rs), mixed into the same signal that reaches
  // the speakers and the recording tap. No separate "connect" step: it
  // rides along on the ASIO session connectInput() already started.
  setMicEnabled(enabled) {
    window.__TAURI__.core.invoke('set_mic_enabled', { enabled }).catch(console.error);
  }

  setMicGain(value) {
    window.__TAURI__.core.invoke('set_mic_gain', { value }).catch(console.error);
  }

  setMicReverb(amount) {
    window.__TAURI__.core.invoke('set_mic_reverb', { amount }).catch(console.error);
  }

  getLatencyInfo() {
    // No Web Audio Context to query on this path. The native chain's
    // real latency was already measured directly in Phase 0/1a (ASIO
    // buffer size + driver-reported latency) — a live per-block readout
    // isn't wired up here, this UI element just doesn't apply.
    return null;
  }

  async dispose() {
    if (this.connected) {
      this.connected = false;
      await window.__TAURI__.core.invoke('stop_passthrough').catch(() => {});
    }
  }
}
