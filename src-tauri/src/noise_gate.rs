// Simple envelope-follower noise gate. Applied after NAM inference, since
// that's where amplified noise floor actually becomes audible (a quiet,
// noisy raw signal into a high-gain model comes out as audible hiss even
// though the noise itself was already present, just inaudible, going in).
//
// Two independent one-pole smoothers: a fast envelope follower tracks the
// (rectified) signal level, and a separate attack/release smoother moves
// the gate's own gain toward 0 or 1 depending on whether that envelope is
// above or below the threshold. Fast attack (opens quickly so pick
// attacks aren't clipped) and slower release (closes gradually so it
// doesn't chop a note's natural decay) are standard for this.
pub struct NoiseGate {
    threshold: f32,
    envelope: f32,
    gain: f32,
    env_coeff: f32,
    attack_coeff: f32,
    release_coeff: f32,
}

fn one_pole_coeff(time_seconds: f64, sample_rate: f64) -> f32 {
    (-1.0 / (time_seconds * sample_rate)).exp() as f32
}

impl NoiseGate {
    pub fn new(sample_rate: f64) -> Self {
        NoiseGate {
            // ~ -36 dBFS. Reasonable default for guitar noise floor; expose
            // as a UI control later if it needs tuning per pickup/gain stage.
            threshold: 0.016,
            envelope: 0.0,
            gain: 0.0,
            env_coeff: one_pole_coeff(0.005, sample_rate),
            attack_coeff: one_pole_coeff(0.003, sample_rate),
            release_coeff: one_pole_coeff(0.150, sample_rate),
        }
    }

    #[allow(dead_code)]
    pub fn set_threshold_linear(&mut self, threshold: f32) {
        self.threshold = threshold.max(0.0);
    }

    /// Real-time safe: no allocation, processes in place.
    pub fn process(&mut self, buf: &mut [f32]) {
        for sample in buf.iter_mut() {
            let rectified = sample.abs();
            self.envelope = self.env_coeff * self.envelope + (1.0 - self.env_coeff) * rectified;

            let target = if self.envelope > self.threshold { 1.0 } else { 0.0 };
            let coeff = if target > self.gain { self.attack_coeff } else { self.release_coeff };
            self.gain = coeff * self.gain + (1.0 - coeff) * target;

            *sample *= self.gain;
        }
    }
}
