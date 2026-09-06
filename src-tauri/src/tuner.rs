// Monophonic pitch detector for a guitar tuner display, autocorrelation-
// based (normalized ACF + parabolic interpolation for sub-sample lag
// accuracy) — a standard, simple, well-understood method for this exact
// use case (single clean note, ~70-400Hz).
//
// IMPORTANT: `analyze` below is deliberately NOT called from the ASIO
// audio callback. An earlier version accumulated samples and ran this
// search inline in the callback once per full window. At this driver's
// 64-sample (~1.45ms @ 44100Hz) buffer size, the O(window * lag_range)
// correlation search (~500 lag candidates x ~4096-sample window, plus a
// few extra evaluations for parabolic interpolation) took several
// milliseconds — comfortably blowing the ~1.45ms callback deadline every
// time the window filled (~93ms), which is exactly the periodic
// background crackle that showed up once the tuner was switched on. See
// asio_engine.rs's tuner capture/background-thread handoff: the callback
// now only ever does a cheap sample copy into a pooled buffer; this
// function runs on a dedicated non-realtime thread instead.

use serde::Serialize;

pub const TUNER_WINDOW_SIZE: usize = 4096;
const MIN_FREQ: f32 = 70.0; // below low E (~82Hz), with margin
const MAX_FREQ: f32 = 400.0; // above high E (~330Hz), with margin
const MIN_CONFIDENCE: f32 = 0.5; // normalized-correlation threshold to accept a reading
const NOTE_NAMES: [&str; 12] =
    ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

#[derive(Serialize, Clone)]
pub struct TunerReading {
    pub frequency: f32,
    #[serde(rename = "noteName")]
    pub note_name: String,
    pub cents: f32,
}

/// Runs the pitch search over one full window of clean (pre-NAM, pre-FX)
/// samples. None means "nothing confident to show" — near-silence, or an
/// ambiguous/noisy signal — not an error.
pub fn analyze(buffer: &[f32], sample_rate: f64) -> Option<TunerReading> {
    let rms = (buffer.iter().map(|s| s * s).sum::<f32>() / buffer.len() as f32).sqrt();
    if rms < 0.01 {
        return None; // near-silence: nothing to tune to
    }

    let min_lag = (sample_rate as f32 / MAX_FREQ) as usize;
    let max_lag = ((sample_rate as f32 / MIN_FREQ) as usize).min(buffer.len() - 2);
    if min_lag < 1 || min_lag >= max_lag {
        return None;
    }

    let correlation_at = |lag: usize| -> f32 {
        let mut corr = 0.0f32;
        let mut norm1 = 0.0f32;
        let mut norm2 = 0.0f32;
        for i in 0..(buffer.len() - lag) {
            let a = buffer[i];
            let b = buffer[i + lag];
            corr += a * b;
            norm1 += a * a;
            norm2 += b * b;
        }
        if norm1 > 0.0 && norm2 > 0.0 {
            corr / (norm1 * norm2).sqrt()
        } else {
            0.0
        }
    };

    let mut best_lag = 0usize;
    let mut best_corr = 0.0f32;
    for lag in min_lag..=max_lag {
        let c = correlation_at(lag);
        if c > best_corr {
            best_corr = c;
            best_lag = lag;
        }
    }

    if best_corr < MIN_CONFIDENCE || best_lag == 0 {
        return None;
    }

    // Parabolic interpolation around the best integer lag for
    // sub-sample accuracy (skip right at the search-range edges).
    let refined_lag = if best_lag > min_lag && best_lag < max_lag {
        let c0 = correlation_at(best_lag - 1);
        let c1 = best_corr;
        let c2 = correlation_at(best_lag + 1);
        let denom = c0 - 2.0 * c1 + c2;
        if denom.abs() > 1e-9 {
            best_lag as f32 + 0.5 * (c0 - c2) / denom
        } else {
            best_lag as f32
        }
    } else {
        best_lag as f32
    };

    let frequency = sample_rate as f32 / refined_lag;
    Some(frequency_to_reading(frequency))
}

fn frequency_to_reading(frequency: f32) -> TunerReading {
    // MIDI note number relative to A4 = 69 = 440Hz.
    let midi = 69.0 + 12.0 * (frequency / 440.0).log2();
    let rounded = midi.round();
    let cents = (midi - rounded) * 100.0;
    let note_index = (rounded as i32).rem_euclid(12) as usize;
    let octave = (rounded as i32) / 12 - 1;
    TunerReading {
        frequency,
        note_name: format!("{}{octave}", NOTE_NAMES[note_index]),
        cents,
    }
}
