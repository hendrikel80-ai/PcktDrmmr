# Pocket Studio — Copyright and License Notices

Copyright (C) 2026 Hendrik

Pocket Studio is free software: you can redistribute it and/or modify it
under the terms of the GNU General Public License as published by the Free
Software Foundation, **version 3** of the License (GPL-3.0-only).

Pocket Studio is distributed in the hope that it will be useful, but WITHOUT
ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
details. The full license text is in [`LICENSE`](LICENSE) and at
<https://www.gnu.org/licenses/gpl-3.0.html>.

**Source code:** <https://github.com/hendrikel80-ai/PcktDrmmr> — every
released installer corresponds to the Git tag of the same version
(e.g. `v0.2.0`).

Why "version 3 only": the Windows build links the Steinberg ASIO SDK, which
Steinberg offers under "General Public License (GPL) Version 3" (alongside
its proprietary license). Pocket Studio uses the SDK under that GPLv3
option, so the combined program is distributed under GPLv3.

---

## Third-party components

Each component keeps its own license. All of them are compatible with
distributing Pocket Studio under GPLv3.

### Steinberg ASIO SDK 2.3.4

- Used under: GNU GPL version 3 (dual-licensed by Steinberg: proprietary
  Steinberg ASIO License **or** GPLv3 — see `LICENSE.txt` inside the SDK).
- Compiled into the Windows desktop app via the `asio-sys` / `cpal` Cargo
  crates. Not stored in this repository; downloaded at build time from
  <https://www.steinberg.net/asiosdk>. Each GitHub release also carries the
  exact SDK archive used for that build, as part of the corresponding
  source.
- Trademark: **ASIO is a trademark of Steinberg Media Technologies GmbH,
  registered in Europe and other countries.**

### Neural Amp Modeler Core

- `src-tauri/vendor/NeuralAmpModelerCore` (Git submodule), including its
  bundled `AudioDSPTools`.
- MIT License, Copyright (c) 2023 Steven Atkinson — see that directory's
  `LICENSE` files.
- Bundled dependencies: Eigen (MPL-2.0, see `Dependencies/eigen/COPYING.*`),
  nlohmann/json (MIT).

### neural-amp-modeler-wasm

- Browser/mobile amp modeling path (`public/nam/`), ISC License.

### LAME MP3 encoder

- Native recordings: `mp3lame-encoder` / `mp3lame-sys` Cargo crates;
  browser/mobile recordings: `@breezystack/lamejs` npm package.
- GNU LGPL (2.1 / 3.0). LGPL code may be combined with a GPLv3 program;
  since the whole program's source is available under GPLv3, the LGPL
  relinking requirement is satisfied.

### Drum samples

- See [`public/samples/LICENSE.md`](public/samples/LICENSE.md).
- `pearl-acoustic`: "Pearl Master Studio Pack 1" by enoe
  (oramics/sampled), **CC-BY 3.0** — attribution required, also shown
  in-app under "Privacy & Credits".
- `trap-hard`, `trap-bounce`, `vintage-soul`: Boochi44/free-drum-samples
  (partly based on Edward Loveall's TR-808 library), CC0 1.0.
- The samples are creative content, not program code; they keep their own
  licenses and are not relicensed under the GPL.

### Fonts

- "Bebas Neue" and "Source Sans 3", SIL Open Font License 1.1.

### npm and Cargo dependencies

- React, Vite, Express, Tauri, cpal and the other dependencies listed in
  `package.json` / `src-tauri/Cargo.toml`, each under its own published
  license (mainly MIT, Apache-2.0, ISC, BSD, MPL-2.0, Unicode-3.0).
