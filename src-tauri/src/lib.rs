mod asio_engine;
mod delay;
mod drum_engine;
mod eq;
mod nam_ffi;
mod noise_gate;
mod reverb;
mod tuner;

use asio_engine::{AsioState, ModelInfo};
use drum_engine::DrumPatternDto;
use tauri::ipc::{InvokeBody, Request, Response};
use tauri::Manager;
use tuner::TunerReading;

/// Resolves the drum-samples directory both in a packaged build (where
/// `tauri.conf.json`'s `bundle.resources` copies `public/samples` in
/// under `<resource_dir>/samples`) and in `cargo tauri dev` (where no
/// bundling happens, so this falls back to the source tree relative to
/// this crate's own manifest — `CARGO_MANIFEST_DIR` is `src-tauri/`, one
/// level below the repo root). Tried in that order since resource_dir()
/// is the correct answer once packaging is actually verified; the dev
/// fallback exists so `cargo tauri dev` keeps working regardless.
fn resolve_samples_dir(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    if let Ok(resource_dir) = app.path().resource_dir() {
        let candidate = resource_dir.join("samples");
        if candidate.is_dir() {
            return Ok(candidate);
        }
    }
    let dev_path = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../public/samples");
    if dev_path.is_dir() {
        return Ok(dev_path);
    }
    Err(format!(
        "could not locate the drum samples directory (checked resource_dir()/samples and {dev_path:?})"
    ))
}

#[tauri::command]
fn list_devices() -> Vec<String> {
    asio_engine::list_device_names()
}

/// Channel count for a driver the user is considering, without starting
/// an actual stream — lets the ASIO settings dialog populate its guitar/
/// mic channel pickers before the user commits to connecting. See
/// `asio_engine::probe_driver_channels`'s doc for the caveat on reliability
/// of probing a driver right before actually starting it.
#[tauri::command]
fn probe_asio_channels(driver_name: String) -> Result<asio_engine::DriverChannelInfo, String> {
    asio_engine::probe_driver_channels(&driver_name)
}

#[tauri::command]
fn start_passthrough(
    app: tauri::AppHandle,
    state: tauri::State<AsioState>,
    driver_name: Option<String>,
    guitar_channel: usize,
    mic_channel: usize,
) -> Result<String, String> {
    // Native (guitar+mic) recordings are written straight to disk as WAV
    // files (see asio_engine.rs's module doc) — Downloads is where the
    // browser's own drum recordings already land, so both halves of a
    // take end up in the same, expected place.
    let recordings_dir = app.path().download_dir().map_err(|e| e.to_string())?;
    asio_engine::start(&state, recordings_dir, driver_name, guitar_channel, mic_channel)
}

#[tauri::command]
fn stop_passthrough(state: tauri::State<AsioState>) -> Result<String, String> {
    asio_engine::stop(&state)
}

#[tauri::command]
fn load_model(state: tauri::State<AsioState>, path: String) -> Result<ModelInfo, String> {
    validate_model_path(&path)?;
    asio_engine::load_model(&state, &path)
}

#[tauri::command]
fn set_input_gain(state: tauri::State<AsioState>, value: f32) -> Result<(), String> {
    asio_engine::set_input_gain(&state, value)
}

#[tauri::command]
fn set_output_gain(state: tauri::State<AsioState>, value: f32) -> Result<(), String> {
    asio_engine::set_output_gain(&state, value)
}

#[tauri::command]
fn set_bass(state: tauri::State<AsioState>, db: f32) -> Result<(), String> {
    asio_engine::set_bass(&state, db)
}

#[tauri::command]
fn set_mid(state: tauri::State<AsioState>, db: f32) -> Result<(), String> {
    asio_engine::set_mid(&state, db)
}

#[tauri::command]
fn set_treble(state: tauri::State<AsioState>, db: f32) -> Result<(), String> {
    asio_engine::set_treble(&state, db)
}

#[tauri::command]
fn set_reverb(state: tauri::State<AsioState>, amount: f32) -> Result<(), String> {
    asio_engine::set_reverb(&state, amount)
}

#[tauri::command]
fn set_delay_enabled(state: tauri::State<AsioState>, enabled: bool) -> Result<(), String> {
    asio_engine::set_delay_enabled(&state, enabled)
}

#[tauri::command]
fn set_delay(state: tauri::State<AsioState>, amount: f32) -> Result<(), String> {
    asio_engine::set_delay(&state, amount)
}

#[tauri::command]
fn set_tuner_enabled(state: tauri::State<AsioState>, enabled: bool) -> Result<(), String> {
    asio_engine::set_tuner_enabled(&state, enabled)
}

#[tauri::command]
fn get_tuner_reading(state: tauri::State<AsioState>) -> Result<Option<TunerReading>, String> {
    asio_engine::get_tuner_reading(&state)
}

#[tauri::command]
fn set_guitar_recording_active(state: tauri::State<AsioState>, active: bool) -> Result<(), String> {
    asio_engine::set_recording_active(&state, active)
}

/// Called from JS right before set_guitar_recording_active(true) — see
/// asio_engine.rs's set_monitoring_latency_ms doc.
#[tauri::command]
fn set_monitoring_latency_ms(state: tauri::State<AsioState>, ms: f32) -> Result<(), String> {
    asio_engine::set_monitoring_latency_ms(&state, ms)
}

/// Called from JS right before set_guitar_recording_active(true) — see
/// asio_engine.rs's set_drum_recording_enabled doc.
#[tauri::command]
fn set_drum_recording_enabled(state: tauri::State<AsioState>, enabled: bool) -> Result<(), String> {
    asio_engine::set_drum_recording_enabled(&state, enabled)
}

/// Keeps the native recording-tap drum engine's output level in sync with
/// the browser's own drum-bus volume slider (see useAudioEngine.js) — sent
/// on every change, not just before recording starts, since the slider is
/// also meant to affect live monitoring loudness expectations for the next
/// take.
#[tauri::command]
fn set_drum_gain(state: tauri::State<AsioState>, value: f32) -> Result<(), String> {
    asio_engine::set_drum_gain(&state, value)
}

#[tauri::command]
fn get_last_native_recording_path(state: tauri::State<AsioState>) -> Result<Option<String>, String> {
    asio_engine::get_last_native_recording_path(&state)
}

#[tauri::command]
fn set_mic_enabled(state: tauri::State<AsioState>, enabled: bool) -> Result<(), String> {
    asio_engine::set_mic_enabled(&state, enabled)
}

#[tauri::command]
fn set_mic_gain(state: tauri::State<AsioState>, value: f32) -> Result<(), String> {
    asio_engine::set_mic_gain(&state, value)
}

#[tauri::command]
fn set_mic_reverb(state: tauri::State<AsioState>, amount: f32) -> Result<(), String> {
    asio_engine::set_mic_reverb(&state, amount)
}

/// Loads a drum kit for the recording-tap-only native drum engine (see
/// drum_engine.rs / asio_engine.rs's module docs) — called from JS
/// whenever the selected kit changes, mirroring how the browser's
/// HybridDrumEngine.loadSamples() already works. `kit_id` is the same
/// folder name used under public/samples/ (KitConfig.samplePath in
/// src/data/kits.js).
#[tauri::command]
fn load_drum_kit(app: tauri::AppHandle, state: tauri::State<AsioState>, kit_id: String) -> Result<(), String> {
    // kit_id normally comes from the fixed KITS list in src/data/kits.js, but
    // — same reasoning as save_recording_bytes's filename — a Tauri command
    // is reachable by any script in the webview, so it's validated here too
    // rather than trusted just because the frontend only ever sends known-good
    // values. drum_engine::load_kit joins it straight onto samples_dir.
    let safe_kit_id = sanitize_filename(&kit_id)?;
    let samples_dir = resolve_samples_dir(&app)?;
    asio_engine::load_drum_kit(&state, &samples_dir, &safe_kit_id)
}

/// Sets the pattern the native drum engine plays into the recording tap —
/// called from JS whenever the sequencer pattern changes, mirroring
/// Scheduler.setPattern() on the browser-monitoring side.
#[tauri::command]
fn set_drum_pattern(state: tauri::State<AsioState>, pattern: DrumPatternDto) -> Result<(), String> {
    asio_engine::set_drum_pattern(&state, pattern)
}

/// Confines a recording-related path to the user's Downloads folder — the
/// only place this app ever writes recordings (see start_passthrough /
/// save_recording_bytes). The frontend is only ever supposed to hand back
/// paths it got from us, but a Tauri command is reachable by any script
/// running in the webview (`window.__TAURI__.core.invoke`, and
/// `withGlobalTauri` in tauri.conf.json makes that global available to
/// everything, not just our own bundle) — so the boundary has to be
/// enforced here, not just documented at the call site. `canonicalize()`
/// also resolves `..`/symlinks before the prefix check, so it can't be
/// talked around with a crafted relative path.
fn confine_to_downloads(app: &tauri::AppHandle, path: &str) -> Result<std::path::PathBuf, String> {
    let downloads = app
        .path()
        .download_dir()
        .map_err(|e| e.to_string())?
        .canonicalize()
        .map_err(|e| e.to_string())?;
    let candidate = std::path::Path::new(path)
        .canonicalize()
        .map_err(|e| e.to_string())?;
    if !candidate.starts_with(&downloads) {
        return Err("path is outside the recordings directory".to_string());
    }
    Ok(candidate)
}

/// Rejects a filename that would let `Path::join` escape its base
/// directory — either via traversal (`../..`) or, worse, via an absolute
/// path, which `PathBuf::join` doesn't append but instead uses to
/// *replace* the base entirely. Keeping only the bare file-name component
/// and requiring it to match the input verbatim rules out both.
fn sanitize_filename(filename: &str) -> Result<String, String> {
    let name = std::path::Path::new(filename)
        .file_name()
        .and_then(|n| n.to_str())
        .filter(|n| *n == filename)
        .ok_or_else(|| "filename must not contain path separators".to_string())?;
    Ok(name.to_string())
}

/// `load_model` accepts a user-chosen path from the native file-open
/// dialog (see NativeGuitarEngine.js), so — unlike the recordings above —
/// it's legitimately outside any single directory and can't be confined
/// the same way. Still worth narrowing: this path ends up read by the
/// NAM C++ FFI layer (nam_ffi.rs), so at minimum it must point at an
/// actual `.nam` file rather than whatever a compromised/scripted caller
/// hands it.
fn validate_model_path(path: &str) -> Result<(), String> {
    let candidate = std::path::Path::new(path)
        .canonicalize()
        .map_err(|e| e.to_string())?;
    if !candidate.is_file() {
        return Err("model path must point at a file".to_string());
    }
    let has_nam_extension = candidate
        .extension()
        .and_then(|e| e.to_str())
        .is_some_and(|e| e.eq_ignore_ascii_case("nam"));
    if !has_nam_extension {
        return Err("model file must have a .nam extension".to_string());
    }
    Ok(())
}

/// Reads a native (guitar+mic) WAV recording's raw bytes, so the frontend
/// can decode it via Web Audio's decodeAudioData and mix it together with
/// the browser's own drum recording — see mergeRecording.js. `path` is
/// always one this same session handed to JS via
/// get_last_native_recording_path, but see confine_to_downloads for why
/// that alone isn't treated as enough.
///
/// Returns `tauri::ipc::Response` instead of a plain `Vec<u8>` so the
/// bytes cross the IPC boundary as a raw octet-stream (the JS side gets
/// back an ArrayBuffer) instead of being JSON-serialized into one array
/// element per byte — for a multi-minute take at 44.1kHz that's tens of
/// millions of individual numbers, which was previously making longer
/// recordings visibly stall the UI on every read.
#[tauri::command]
fn read_native_recording(app: tauri::AppHandle, path: String) -> Result<Response, String> {
    let confined = confine_to_downloads(&app, &path)?;
    let bytes = std::fs::read(&confined).map_err(|e| e.to_string())?;
    Ok(Response::new(bytes))
}

/// Deletes a recording file — the RecordingPanel.jsx trash button now
/// removes the actual take, not just its list entry. `path` is always one
/// this same session either wrote itself (native recordings,
/// merged-fallback recordings saved via save_recording_bytes below) or
/// read back via read_native_recording, but see confine_to_downloads for
/// why that alone isn't treated as enough.
///
/// Uses `trash::delete` (moves to the OS Recycle Bin) instead of
/// `std::fs::remove_file` — RecordingPanel.jsx's confirm dialog guards
/// against most stray clicks, but a take is a one-of-a-kind performance,
/// not a regenerable temp file, so a second, recoverable safety net is
/// worth the one extra dependency: an accidental delete (or a bug in the
/// confine/confirm logic above) is a trip to the Recycle Bin, not a
/// permanently lost recording.
#[tauri::command]
fn delete_recording_file(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let confined = confine_to_downloads(&app, &path)?;
    trash::delete(&confined).map_err(|e| e.to_string())
}

/// Saves a finished recording's bytes (e.g. the JS-side merged-fallback
/// WAV from mergeRecording.js, which otherwise only ever exists as an
/// in-memory Blob) to the same Downloads folder start_passthrough already
/// uses for native takes — so every entry in RecordingPanel.jsx's list is
/// backed by a real file the trash button can actually delete. Returns the
/// full path so the frontend can store it alongside the recording entry.
///
/// Takes a raw `tauri::ipc::Request` instead of a `Vec<u8>` argument, so
/// the frontend can hand over the audio bytes as an actual binary IPC
/// payload (a JS `Uint8Array` passed directly to `invoke`) rather than a
/// JSON array of numbers — same reasoning as read_native_recording's
/// `Response` return type, just for the opposite direction. The filename
/// travels alongside as a request header since a raw body leaves no room
/// for other structured fields.
#[tauri::command]
fn save_recording_bytes(app: tauri::AppHandle, request: Request) -> Result<String, String> {
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err("expected a raw binary request body".to_string());
    };
    let filename = request
        .headers()
        .get("x-filename")
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| "missing x-filename header".to_string())?;
    let safe_name = sanitize_filename(filename)?;
    let dir = app.path().download_dir().map_err(|e| e.to_string())?;
    let path = dir.join(safe_name);
    std::fs::write(&path, bytes).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

/// Renames a recording file in place within Downloads — RecordingPanel.jsx's
/// rename control. `path` is confined the same way as delete/read above.
/// `new_filename` is sanitized to a bare filename (no traversal), and the
/// caller (useAudioEngine.js's renameRecording) is responsible for keeping
/// the original extension so a renamed take stays picked up by
/// list_recordings' `.mp3`/`.wav` filter after a restart. Refuses to
/// silently overwrite an existing file at the destination.
#[tauri::command]
fn rename_recording_file(app: tauri::AppHandle, path: String, new_filename: String) -> Result<String, String> {
    let confined = confine_to_downloads(&app, &path)?;
    let safe_name = sanitize_filename(&new_filename)?;
    let dir = app.path().download_dir().map_err(|e| e.to_string())?;
    let new_path = dir.join(&safe_name);
    if new_path.exists() {
        return Err("a recording with that name already exists".to_string());
    }
    std::fs::rename(&confined, &new_path).map_err(|e| e.to_string())?;
    Ok(new_path.to_string_lossy().to_string())
}

#[derive(serde::Serialize)]
struct RecordingEntry {
    path: String,
    filename: String,
    #[serde(rename = "modifiedMs")]
    modified_ms: u64,
}

/// Lists this app's own finished recordings still sitting in the Downloads
/// folder, newest first — so RecordingPanel.jsx can show them again after
/// an app restart instead of the list starting empty every time (it only
/// ever lived in memory before this). The files themselves were never at
/// risk — this just makes them visible/playable/deletable again in the UI
/// without the user having to go dig through Explorer.
///
/// Matches on the same `pocket-studio-riff-*` naming both asio_engine.rs
/// (native takes) and useAudioEngine.js (merge-fallback takes) already
/// use, so it only ever picks up this app's own files, not unrelated
/// Downloads-folder content. Accepts both `.mp3` (current format) and
/// `.wav` (recordings made before the MP3 switch) so older takes don't
/// just vanish from the list.
#[tauri::command]
fn list_recordings(app: tauri::AppHandle) -> Result<Vec<RecordingEntry>, String> {
    let dir = app.path().download_dir().map_err(|e| e.to_string())?;
    let mut entries = Vec::new();

    // A missing/inaccessible Downloads folder means "nothing to show yet",
    // not a hard error — same spirit as the rest of this app's recording
    // code, which never treats an empty list as a failure.
    let Ok(read_dir) = std::fs::read_dir(&dir) else {
        return Ok(entries);
    };

    for entry in read_dir.flatten() {
        let path = entry.path();
        let Some(filename) = path.file_name().and_then(|n| n.to_str()) else {
            continue;
        };
        let lower = filename.to_lowercase();
        let has_known_extension = lower.ends_with(".mp3") || lower.ends_with(".wav");
        if !lower.starts_with("pocket-studio-riff-") || !has_known_extension {
            continue;
        }
        let modified_ms = entry
            .metadata()
            .and_then(|m| m.modified())
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);
        entries.push(RecordingEntry {
            path: path.to_string_lossy().to_string(),
            filename: filename.to_string(),
            modified_ms,
        });
    }

    entries.sort_by(|a, b| b.modified_ms.cmp(&a.modified_ms));
    Ok(entries)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(AsioState::default())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_devices,
            probe_asio_channels,
            start_passthrough,
            stop_passthrough,
            load_model,
            set_input_gain,
            set_output_gain,
            set_bass,
            set_mid,
            set_treble,
            set_reverb,
            set_delay_enabled,
            set_delay,
            set_tuner_enabled,
            get_tuner_reading,
            set_guitar_recording_active,
            set_monitoring_latency_ms,
            set_drum_recording_enabled,
            set_drum_gain,
            get_last_native_recording_path,
            set_mic_enabled,
            set_mic_gain,
            set_mic_reverb,
            read_native_recording,
            delete_recording_file,
            rename_recording_file,
            save_recording_bytes,
            load_drum_kit,
            set_drum_pattern,
            list_recordings
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
