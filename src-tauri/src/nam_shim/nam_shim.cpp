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
};
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
    // DSP::process() wants NAM_SAMPLE** (one pointer per channel); we only
    // ever run mono. NAM_SAMPLE is float here (compiled with
    // -DNAM_SAMPLE_FLOAT, see build.rs) so no per-sample conversion is
    // needed. process() only reads the input buffer despite the
    // non-const signature.
    NAM_SAMPLE* in_ch[1] = {const_cast<NAM_SAMPLE*>(input)};
    NAM_SAMPLE* out_ch[1] = {output};
    inst->dsp->process(in_ch, out_ch, num_frames);
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
