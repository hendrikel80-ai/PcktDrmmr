mod asio_engine;
mod delay;
mod eq;
mod nam_ffi;
mod noise_gate;
mod reverb;
mod tuner;

use asio_engine::{AsioState, GuitarAudioChunk, ModelInfo};
use tuner::TunerReading;

#[tauri::command]
fn list_devices() -> Vec<String> {
    asio_engine::list_device_names()
}

#[tauri::command]
fn start_passthrough(state: tauri::State<AsioState>) -> Result<String, String> {
    asio_engine::start(&state)
}

#[tauri::command]
fn stop_passthrough(state: tauri::State<AsioState>) -> Result<String, String> {
    asio_engine::stop(&state)
}

#[tauri::command]
fn load_model(state: tauri::State<AsioState>, path: String) -> Result<ModelInfo, String> {
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

#[tauri::command]
fn drain_guitar_audio(state: tauri::State<AsioState>) -> Result<GuitarAudioChunk, String> {
    asio_engine::drain_guitar_audio(&state)
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
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
            drain_guitar_audio,
            set_mic_enabled,
            set_mic_gain,
            set_mic_reverb
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
