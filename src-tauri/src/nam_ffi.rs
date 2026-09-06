// Safe(-ish) Rust wrapper around the C-linkage shim in src/nam_shim/,
// which itself wraps NeuralAmpModelerCore. See nam_shim/nam_shim.h for the
// raw surface.

use std::ffi::{c_char, c_int, CStr, CString};

#[repr(C)]
struct NamOpaque {
    _private: [u8; 0],
}
type NamHandleRaw = *mut NamOpaque;

unsafe extern "C" {
    fn nam_load(path_utf8: *const c_char, sample_rate: f64, max_buffer_size: c_int) -> NamHandleRaw;
    fn nam_destroy(handle: NamHandleRaw);
    fn nam_process(handle: NamHandleRaw, input: *const f32, output: *mut f32, num_frames: c_int);
    fn nam_expected_sample_rate(handle: NamHandleRaw) -> f64;
    fn nam_num_input_channels(handle: NamHandleRaw) -> c_int;
    fn nam_num_output_channels(handle: NamHandleRaw) -> c_int;
    fn nam_has_loudness(handle: NamHandleRaw) -> c_int;
    fn nam_get_loudness(handle: NamHandleRaw) -> f64;
    fn nam_last_error() -> *const c_char;
}

pub struct NamModel {
    handle: NamHandleRaw,
    pub expected_sample_rate: f64,
    pub num_input_channels: i32,
    pub num_output_channels: i32,
    pub has_loudness: bool,
    pub loudness: f64,
}

// SAFETY: NamModel owns its handle exclusively (no other code holds a
// reference to the same nam::DSP*), and the DSP object itself doesn't
// reach back into any thread-affine state — it's plain buffers + Eigen
// matrices. We're the ones deciding to build it on a background thread and
// hand it to the audio thread (see asio_engine.rs); nothing here makes
// that unsound, it just isn't proven by the type system on its own.
unsafe impl Send for NamModel {}

impl NamModel {
    /// Loads and Reset()s a model for the given sample rate / max block
    /// size. Does file I/O and JSON parsing — call this off the audio
    /// thread only.
    pub fn load(path: &str, sample_rate: f64, max_buffer_size: i32) -> Result<Self, String> {
        let c_path = CString::new(path).map_err(|e| e.to_string())?;
        let handle = unsafe { nam_load(c_path.as_ptr(), sample_rate, max_buffer_size) };
        if handle.is_null() {
            return Err(last_error().unwrap_or_else(|| "unknown NAM load error".to_string()));
        }
        let model = NamModel {
            handle,
            expected_sample_rate: unsafe { nam_expected_sample_rate(handle) },
            num_input_channels: unsafe { nam_num_input_channels(handle) },
            num_output_channels: unsafe { nam_num_output_channels(handle) },
            has_loudness: unsafe { nam_has_loudness(handle) != 0 },
            loudness: unsafe { nam_get_loudness(handle) },
        };
        Ok(model)
    }

    /// Real-time safe: no allocation, no exceptions can escape (caught on
    /// the C++ side). `input`/`output` must be equal length.
    pub fn process(&mut self, input: &[f32], output: &mut [f32]) {
        debug_assert_eq!(input.len(), output.len());
        unsafe {
            nam_process(self.handle, input.as_ptr(), output.as_mut_ptr(), input.len() as c_int);
        }
    }
}

impl Drop for NamModel {
    fn drop(&mut self) {
        unsafe { nam_destroy(self.handle) };
    }
}

fn last_error() -> Option<String> {
    unsafe {
        let ptr = nam_last_error();
        if ptr.is_null() {
            None
        } else {
            Some(CStr::from_ptr(ptr).to_string_lossy().into_owned())
        }
    }
}
