// 3-band tone stack (Bass/Mid/Treble), ported from the browser version's
// BiquadFilterNode chain (GuitarEngine.js: lowshelf @150Hz, peaking @800Hz
// Q=0.8, highshelf @3000Hz) — same frequencies/Q, standard RBJ Audio EQ
// Cookbook biquad formulas, Direct Form I.

#[derive(Clone, Copy, Default)]
struct BiquadCoeffs {
    b0: f32,
    b1: f32,
    b2: f32,
    a1: f32,
    a2: f32,
}

#[derive(Default)]
struct BiquadState {
    x1: f32,
    x2: f32,
    y1: f32,
    y2: f32,
}

impl BiquadState {
    fn process(&mut self, c: &BiquadCoeffs, x0: f32) -> f32 {
        let y0 = c.b0 * x0 + c.b1 * self.x1 + c.b2 * self.x2 - c.a1 * self.y1 - c.a2 * self.y2;
        self.x2 = self.x1;
        self.x1 = x0;
        self.y2 = self.y1;
        self.y1 = y0;
        y0
    }
}

fn lowshelf(sample_rate: f64, freq: f64, db_gain: f32) -> BiquadCoeffs {
    let a = 10f64.powf(db_gain as f64 / 40.0);
    let w0 = 2.0 * std::f64::consts::PI * freq / sample_rate;
    let cos_w0 = w0.cos();
    let alpha = w0.sin() / 2.0 * ((a + 1.0 / a) + 2.0).sqrt(); // S = 1
    let sqrt_a = a.sqrt();

    let b0 = a * ((a + 1.0) - (a - 1.0) * cos_w0 + 2.0 * sqrt_a * alpha);
    let b1 = 2.0 * a * ((a - 1.0) - (a + 1.0) * cos_w0);
    let b2 = a * ((a + 1.0) - (a - 1.0) * cos_w0 - 2.0 * sqrt_a * alpha);
    let a0 = (a + 1.0) + (a - 1.0) * cos_w0 + 2.0 * sqrt_a * alpha;
    let a1 = -2.0 * ((a - 1.0) + (a + 1.0) * cos_w0);
    let a2 = (a + 1.0) + (a - 1.0) * cos_w0 - 2.0 * sqrt_a * alpha;

    normalize(b0, b1, b2, a0, a1, a2)
}

fn highshelf(sample_rate: f64, freq: f64, db_gain: f32) -> BiquadCoeffs {
    let a = 10f64.powf(db_gain as f64 / 40.0);
    let w0 = 2.0 * std::f64::consts::PI * freq / sample_rate;
    let cos_w0 = w0.cos();
    let alpha = w0.sin() / 2.0 * ((a + 1.0 / a) + 2.0).sqrt(); // S = 1
    let sqrt_a = a.sqrt();

    let b0 = a * ((a + 1.0) + (a - 1.0) * cos_w0 + 2.0 * sqrt_a * alpha);
    let b1 = -2.0 * a * ((a - 1.0) + (a + 1.0) * cos_w0);
    let b2 = a * ((a + 1.0) + (a - 1.0) * cos_w0 - 2.0 * sqrt_a * alpha);
    let a0 = (a + 1.0) - (a - 1.0) * cos_w0 + 2.0 * sqrt_a * alpha;
    let a1 = 2.0 * ((a - 1.0) - (a + 1.0) * cos_w0);
    let a2 = (a + 1.0) - (a - 1.0) * cos_w0 - 2.0 * sqrt_a * alpha;

    normalize(b0, b1, b2, a0, a1, a2)
}

fn peaking(sample_rate: f64, freq: f64, q: f64, db_gain: f32) -> BiquadCoeffs {
    let a = 10f64.powf(db_gain as f64 / 40.0);
    let w0 = 2.0 * std::f64::consts::PI * freq / sample_rate;
    let cos_w0 = w0.cos();
    let alpha = w0.sin() / (2.0 * q);

    let b0 = 1.0 + alpha * a;
    let b1 = -2.0 * cos_w0;
    let b2 = 1.0 - alpha * a;
    let a0 = 1.0 + alpha / a;
    let a1 = -2.0 * cos_w0;
    let a2 = 1.0 - alpha / a;

    normalize(b0, b1, b2, a0, a1, a2)
}

fn normalize(b0: f64, b1: f64, b2: f64, a0: f64, a1: f64, a2: f64) -> BiquadCoeffs {
    BiquadCoeffs {
        b0: (b0 / a0) as f32,
        b1: (b1 / a0) as f32,
        b2: (b2 / a0) as f32,
        a1: (a1 / a0) as f32,
        a2: (a2 / a0) as f32,
    }
}

pub struct ToneStack {
    sample_rate: f64,
    bass_coeffs: BiquadCoeffs,
    mid_coeffs: BiquadCoeffs,
    treble_coeffs: BiquadCoeffs,
    bass_state: BiquadState,
    mid_state: BiquadState,
    treble_state: BiquadState,
}

impl ToneStack {
    pub fn new(sample_rate: f64) -> Self {
        ToneStack {
            sample_rate,
            bass_coeffs: lowshelf(sample_rate, 150.0, 0.0),
            mid_coeffs: peaking(sample_rate, 800.0, 0.8, 0.0),
            treble_coeffs: highshelf(sample_rate, 3000.0, 0.0),
            bass_state: BiquadState::default(),
            mid_state: BiquadState::default(),
            treble_state: BiquadState::default(),
        }
    }

    /// Recomputes coefficients from current dB values. Cheap (a handful of
    /// trig ops), fine to call once per block from the audio thread rather
    /// than needing sample-accurate smoothing for this phase.
    pub fn set_gains_db(&mut self, bass_db: f32, mid_db: f32, treble_db: f32) {
        self.bass_coeffs = lowshelf(self.sample_rate, 150.0, bass_db);
        self.mid_coeffs = peaking(self.sample_rate, 800.0, 0.8, mid_db);
        self.treble_coeffs = highshelf(self.sample_rate, 3000.0, treble_db);
    }

    pub fn process(&mut self, buf: &mut [f32]) {
        for sample in buf.iter_mut() {
            let s = self.bass_state.process(&self.bass_coeffs, *sample);
            let s = self.mid_state.process(&self.mid_coeffs, s);
            let s = self.treble_state.process(&self.treble_coeffs, s);
            *sample = s;
        }
    }
}
