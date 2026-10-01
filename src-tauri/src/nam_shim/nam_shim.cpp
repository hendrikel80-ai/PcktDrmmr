#include "nam_shim.h"
#include "get_dsp.h"

#include <exception>
#include <memory>
#include <string>

namespace
{
thread_local std::string g_last_error;

struct NamInstance
{
  std::unique_ptr<nam::DSP> dsp;
  // See nam_process's use of this: counts consecutive process() failures
  // so a model that throws deterministically on every block gets cut off
  // instead of paying C++ exception unwind cost on every single audio
  // callback.
  int consecutive_process_errors = 0;
};

// After this many consecutive nam_process() exceptions on the same
// handle, stop calling dsp->process() for it entirely (silence only)
// until it's reloaded. A single throw is an acceptable, self-correcting
// glitch (see nam_process); a model that fails on every block is a
// deterministic failure, and retrying it every ~1.45ms block would mean
// paying the (not zero-cost) throw/unwind machinery on every callback —
// a sustained deadline-miss risk, not a one-off blip.
constexpr int kMaxConsecutiveProcessErrors = 8;
} // namespace

extern "C"
{

  NamHandle nam_load(const char* path_utf8, double sample_rate, int max_buffer_size)
  {
    g_last_error.clear();
    try
    {
      // Build the path from a UTF-8 byte string directly (std::filesystem::u8path
      // is deprecated as of C++20) rather than assuming the native narrow encoding.
      std::u8string u8(reinterpret_cast<const char8_t*>(path_utf8));
      std::filesystem::path path(u8);

      auto dsp = nam::get_dsp(path);
      if (!dsp)
      {
        g_last_error = "get_dsp() returned null";
        return nullptr;
      }
      dsp->Reset(sample_rate, max_buffer_size);

      auto* inst = new NamInstance{std::move(dsp)};
      return inst;
    }
    catch (const std::exception& e)
    {
      g_last_error = e.what();
      return nullptr;
    }
    catch (...)
    {
      g_last_error = "unknown error loading model";
      return nullptr;
    }
  }

  void nam_destroy(NamHandle handle)
  {
    if (handle)
    {
      delete static_cast<NamInstance*>(handle);
    }
  }

  void nam_process(NamHandle handle, const float* input, float* output, int num_frames)
  {
    if (!handle)
      return;
    auto* inst = static_cast<NamInstance*>(handle);

    if (inst->consecutive_process_errors >= kMaxConsecutiveProcessErrors)
    {
      // Given up on this handle — see kMaxConsecutiveProcessErrors above.
      for (int i = 0; i < num_frames; ++i)
      {
        output[i] = 0.0f;
      }
      return;
    }

    // DSP::process() wants NAM_SAMPLE** (one pointer per channel); we only
    // ever run mono. NAM_SAMPLE is float here (compiled with
    // -DNAM_SAMPLE_FLOAT, see build.rs) so no per-sample conversion is
    // needed. process() only reads the input buffer despite the
    // non-const signature.
    NAM_SAMPLE* in_ch[1] = {const_cast<NAM_SAMPLE*>(input)};
    NAM_SAMPLE* out_ch[1] = {output};
    try
    {
      inst->dsp->process(in_ch, out_ch, num_frames);
      inst->consecutive_process_errors = 0;
    }
    catch (...)
    {
      // This runs on the real-time ASIO callback thread (see
      // asio_engine.rs) — an exception unwinding across this extern "C"
      // boundary is undefined behavior, not a normal error path. A
      // model that throws mid-stream (corrupt weights discovered lazily,
      // a dimension mismatch Reset() didn't catch, ...) gets silence for
      // this buffer instead of taking down the audio thread. This is what
      // nam_shim.h's "no exceptions can escape" doc comment already
      // promises; the implementation just didn't keep that promise here.
      ++inst->consecutive_process_errors;
      for (int i = 0; i < num_frames; ++i)
      {
        output[i] = 0.0f;
      }
    }
  }

  double nam_expected_sample_rate(NamHandle handle)
  {
    if (!handle)
      return -1.0;
    return static_cast<NamInstance*>(handle)->dsp->GetExpectedSampleRate();
  }

  int nam_num_input_channels(NamHandle handle)
  {
    if (!handle)
      return 0;
    return static_cast<NamInstance*>(handle)->dsp->NumInputChannels();
  }

  int nam_num_output_channels(NamHandle handle)
  {
    if (!handle)
      return 0;
    return static_cast<NamInstance*>(handle)->dsp->NumOutputChannels();
  }

  int nam_has_loudness(NamHandle handle)
  {
    if (!handle)
      return 0;
    return static_cast<NamInstance*>(handle)->dsp->HasLoudness() ? 1 : 0;
  }

  double nam_get_loudness(NamHandle handle)
  {
    if (!handle)
      return 0.0;
    try
    {
      return static_cast<NamInstance*>(handle)->dsp->GetLoudness();
    }
    catch (...)
    {
      return 0.0;
    }
  }

  const char* nam_last_error() { return g_last_error.empty() ? nullptr : g_last_error.c_str(); }
}
