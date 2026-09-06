// Freeverb-style algorithmic reverb (Jezar's classic public-domain design:
// 8 parallel comb filters + 4 series allpass filters), mono. Chosen per
// the plan over porting the browser's ConvolverNode approach — naive
// time-domain convolution against a long IR is far too expensive for a
// real-time callback and would need FFT partitioned convolution to be
// viable; this is allocation-free, no FFT, and gets the same "dezenter
// Raumhall" character the browser version was going for with its own
// procedurally-generated IR.
//
// Delay lengths are Freeverb's originals, tuned for 44100Hz; scaled by the
// actual sample rate so the character stays consistent if that ever
// differs.

const COMB_TUNING: [usize; 8] = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
const ALLPASS_TUNING: [usize; 4] = [556, 441, 341, 225];
const ALLPASS_FEEDBACK: f32 = 0.5;

struct Comb {
    buffer: Vec<f32>,
    pos: usize,
    filter_store: f32,
    feedback: f32,
    damp: f32,
}

impl Comb {
    fn new(len: usize, feedback: f32, damp: f32) -> Self {
        Comb {
            buffer: vec![0.0; len],
            pos: 0,
            filter_store: 0.0,
            feedback,
            damp,
        }
    }

    #[inline]
    fn process(&mut self, input: f32) -> f32 {
        let out = self.buffer[self.pos];
        self.filter_store = out * (1.0 - self.damp) + self.filter_store * self.damp;
        self.buffer[self.pos] = input + self.filter_store * self.feedback;
        self.pos = (self.pos + 1) % self.buffer.len();
        out
    }
}

struct Allpass {
    buffer: Vec<f32>,
    pos: usize,
}

impl Allpass {
    fn new(len: usize) -> Self {
        Allpass {
            buffer: vec![0.0; len],
            pos: 0,
        }
    }

    #[inline]
    fn process(&mut self, input: f32) -> f32 {
        let delayed = self.buffer[self.pos];
        let out = -input + delayed;
        self.buffer[self.pos] = input + delayed * ALLPASS_FEEDBACK;
        self.pos = (self.pos + 1) % self.buffer.len();
        out
    }
}

pub struct Reverb {
    combs: Vec<Comb>,
    allpasses: Vec<Allpass>,
    wet: f32,
}

impl Reverb {
    pub fn new(sample_rate: f64) -> Self {
        let scale = sample_rate / 44100.0;
        // Damping raised from Freeverb's usual 0.2 to 0.5, and feedback
        // trimmed from 0.84 to 0.80 — the higher-damping/shorter-decay
        // combination rolls off the ringing high end that was reading as
        // "artificial"/metallic, closer to a dark, absorbent practice-room
        // tail than a bright hall.
        let combs = COMB_TUNING
            .iter()
            .map(|&len| Comb::new(((len as f64) * scale).round() as usize, 0.80, 0.5))
            .collect();
        let allpasses = ALLPASS_TUNING
            .iter()
            .map(|&len| Allpass::new(((len as f64) * scale).round() as usize))
            .collect();
        Reverb {
            combs,
            allpasses,
            wet: 0.15,
        }
    }

    /// 0 = dry, no reverb contribution. Additive send level (not an
    /// equal-power dry/wet crossfade), matching the browser version's
    /// design — dry signal always passes through at full level. `wet` is
    /// the raw 0-1 UI slider value; squared and capped below 1 so the
    /// full slider travel maps to a more usable range (a direct linear
    /// 0-1 send made even modest slider positions sound too present) and
    /// the low end gets finer control (most of the slider's motion now
    /// covers a smaller, more subtle range of actual send level).
    pub fn set_wet(&mut self, wet: f32) {
        let clamped = wet.clamp(0.0, 1.0);
        const MAX_WET: f32 = 0.5;
        self.wet = clamped * clamped * MAX_WET;
    }

    pub fn process(&mut self, buf: &mut [f32]) {
        if self.wet <= 0.0001 {
            return;
        }
        for sample in buf.iter_mut() {
            let input = *sample;
            let mut wet_sum = 0.0;
            for comb in self.combs.iter_mut() {
                wet_sum += comb.process(input);
            }
            // 8 combs fed the same input and summed would otherwise scale
            // the wet level with comb count rather than with `wet` itself.
            wet_sum /= self.combs.len() as f32;
            for allpass in self.allpasses.iter_mut() {
                wet_sum = allpass.process(wet_sum);
            }
            *sample = input + wet_sum * self.wet;
        }
    }
}
