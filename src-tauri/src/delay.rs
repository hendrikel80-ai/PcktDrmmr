// Simple single-tap delay with feedback (repeats) and a wet mix, on/off
// switchable. Fixed delay time for now (not exposed as its own control —
// the user asked for on/off + an amount knob "like reverb", not a full
// tempo-synced multi-tap unit); 400ms gives a clearly audible, spaced-out
// echo rather than a tight slapback.

const DELAY_TIME_MS: f64 = 400.0;
const FEEDBACK: f32 = 0.35;

pub struct Delay {
    buffer: Vec<f32>,
    pos: usize,
    enabled: bool,
    wet: f32,
}

impl Delay {
    pub fn new(sample_rate: f64) -> Self {
        let len = ((DELAY_TIME_MS / 1000.0) * sample_rate).round() as usize;
        Delay {
            buffer: vec![0.0; len.max(1)],
            pos: 0,
            enabled: false,
            wet: 0.0,
        }
    }

    pub fn set_enabled(&mut self, enabled: bool) {
        self.enabled = enabled;
    }

    /// Raw 0-1 UI slider value, squared for the same finer-low-end-control
    /// reasoning as Reverb::set_wet.
    pub fn set_wet(&mut self, wet: f32) {
        let clamped = wet.clamp(0.0, 1.0);
        self.wet = clamped * clamped;
    }

    pub fn process(&mut self, buf: &mut [f32]) {
        if !self.enabled || self.wet <= 0.0001 {
            return;
        }
        for sample in buf.iter_mut() {
            let input = *sample;
            let delayed = self.buffer[self.pos];
            self.buffer[self.pos] = input + delayed * FEEDBACK;
            self.pos = (self.pos + 1) % self.buffer.len();
            *sample = input + delayed * self.wet;
        }
    }
}
