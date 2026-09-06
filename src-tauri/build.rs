use std::path::{Path, PathBuf};

fn main() {
    tauri_build::build();
    build_nam_core();
}

/// Compiles NeuralAmpModelerCore (vendored as a git submodule under
/// vendor/NeuralAmpModelerCore) plus our C-linkage shim directly, without
/// going through its own CMake build — its CMakeLists.txt is geared
/// towards building the project's own dev/test tools (tools/CMakeLists.txt),
/// not producing a reusable library target. Eigen and nlohmann/json are
/// header-only, so this is just compiling NAM's .cpp files (see
/// tools/CMakeLists.txt for the authoritative source list this mirrors:
/// glob(NAM/*.cpp) + glob(NAM/*/*.cpp)) — no CMake invocation needed.
fn build_nam_core() {
    let manifest_dir = PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").unwrap());
    let core_dir = manifest_dir.join("vendor/NeuralAmpModelerCore");
    let nam_dir = core_dir.join("NAM");

    if !nam_dir.exists() {
        panic!(
            "NeuralAmpModelerCore submodule not found at {}. Run: git submodule update --init --recursive",
            core_dir.display()
        );
    }

    let mut sources = collect_cpp_files(&nam_dir, false);
    sources.extend(collect_cpp_files(&nam_dir.join("wavenet"), false));
    sources.push(manifest_dir.join("src/nam_shim/nam_shim.cpp"));

    let mut build = cc::Build::new();
    build
        .cpp(true)
        .std("c++20")
        .define("NAM_SAMPLE_FLOAT", None)
        .define("NAM_ENABLE_A2_FAST", None)
        .include(&core_dir)
        .include(&nam_dir) // NAM/*.h headers include each other by bare filename
        .include(core_dir.join("Dependencies/eigen"))
        .include(core_dir.join("Dependencies/nlohmann"))
        .include(manifest_dir.join("src/nam_shim"))
        .files(&sources);

    // Eigen/NAM trip a lot of warnings under cc's own default warning flags
    // (/W4 on MSVC); this is vendored third-party code we're not going to
    // fix upstream warnings in, so just turn cc's defaults off entirely
    // rather than fight flag ordering.
    build.warnings(false);

    if cfg!(target_os = "windows") {
        build.define("NOMINMAX", None).define("WIN32_LEAN_AND_MEAN", None);
    }

    // NAM's architectures (WaveNet, ConvNet, LSTM, Linear, Sequential,
    // Container/SlimmableContainer, ...) self-register into a runtime
    // registry via file-scope static initializers (e.g. container.cpp:
    // `static ConfigParserHelper _register_SlimmableContainer(...)`).
    // Nothing else in the program calls into those .cpp files directly, so
    // a normal static-library link only pulls in object files that
    // contribute a referenced symbol — the linker silently drops every one
    // of these "registration-only" objects, and get_dsp() then fails with
    // "No config parser registered for architecture: ..." for anything
    // that isn't already reachable some other way. Fix: disable cc's own
    // automatic link directive and link the archive with `+whole-archive`
    // ourselves, which forces every object file in, static initializers
    // included.
    build.cargo_metadata(false);
    build.compile("nam_core");
    let out_dir = PathBuf::from(std::env::var("OUT_DIR").unwrap());
    println!("cargo:rustc-link-search=native={}", out_dir.display());
    println!("cargo:rustc-link-lib=static:+whole-archive=nam_core");

    for src in &sources {
        println!("cargo:rerun-if-changed={}", src.display());
    }
    println!("cargo:rerun-if-changed={}", manifest_dir.join("src/nam_shim/nam_shim.h").display());
}

fn collect_cpp_files(dir: &Path, recurse: bool) -> Vec<PathBuf> {
    let mut out = Vec::new();
    let entries = std::fs::read_dir(dir)
        .unwrap_or_else(|e| panic!("failed to read {}: {e}", dir.display()));
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            if recurse {
                out.extend(collect_cpp_files(&path, recurse));
            }
        } else if path.extension().is_some_and(|ext| ext == "cpp") {
            out.push(path);
        }
    }
    out
}
