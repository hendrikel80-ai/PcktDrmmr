// Thin C-linkage shim around NeuralAmpModelerCore's C++ API (NAM/get_dsp.h,
// NAM/dsp.h), narrow enough to bind by hand from Rust instead of pulling in
// bindgen/cxx for a handful of calls. See the plan (curried-mixing-fox.md,
// Phase 2) for why: the real API is idiomatic C++ (std::filesystem::path,
// exceptions) that doesn't translate cleanly, and a narrow opaque-pointer
// surface keeps full control over what happens on the real-time audio
// thread (nam_process must never allocate).
#pragma once

extern "C"
{
  typedef void* NamHandle;

  // Loads a .nam model from a UTF-8 file path and Reset()s it for the given
  // sample rate / max block size. Returns nullptr on failure; call
  // nam_last_error() for a message. sample_rate/max_buffer_size should match
  // what nam_process() will actually be called with.
  NamHandle nam_load(const char* path_utf8, double sample_rate, int max_buffer_size);

  // Safe to call with nullptr.
  void nam_destroy(NamHandle handle);

  // Mono in, mono out — input/output are separate float arrays of
  // num_frames length. Real-time safe: no allocation, no exceptions can
  // escape (caught internally). No-op if handle is null.
  void nam_process(NamHandle handle, const float* input, float* output, int num_frames);

  // Metadata queries. Sample rate is -1.0 if the model doesn't declare one.
  double nam_expected_sample_rate(NamHandle handle);
  int nam_num_input_channels(NamHandle handle);
  int nam_num_output_channels(NamHandle handle);
  int nam_has_loudness(NamHandle handle);
  double nam_get_loudness(NamHandle handle);

  // Message from the most recent failed nam_load() on this thread, or
  // nullptr if none. Pointer is valid until the next nam_load() call on the
  // same thread.
  const char* nam_last_error();
}
