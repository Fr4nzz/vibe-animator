# Third-party code and assets

vibe-animator's own code is MIT, © 2026 Fr4nzz (see `LICENSE`). It contains or derives from the following works, each under its own
licence. Keep this file in sync when you add code or assets.

## Code

### mexicat/pdoom-video ("I'm Upping My P(doom)" music-video engine)

- Source: https://github.com/mexicat/pdoom-video
- Copyright (c) 2026 Giacomo Magnanini. MIT License (full text below; a verbatim copy is in `engine/LICENSE.pdoom-video`).
- Used: the engine core in `engine/app/src/engine/` (WebGL compositor, post-processing, fonts and stroke-font
  loaders, lyrics/audio data model, HUD), the export API in `engine/app/src/main.ts`, and the offline renderer
  `engine/app/scripts/render.ts`, all adapted. The song scenes are not included. Everything under
  `engine/app/src/scenes/`, the agent scripts (`qa.ts`, `render_chapter.ts`, `encode.ts`, `lib.ts`, `grid.ts`,
  `typecheck.ts`, `kit_index.ts`), the captions and the Python pipeline in `tools/` are vibe-animator's own (MIT).

### JohnHeibel/ClaudeAnimationBase

- Source: https://github.com/JohnHeibel/ClaudeAnimationBase
- Copyright (c) 2026 John Heibel. MIT License (full text below).
- Used: ideas, and one small adapted snippet: the agent workflow of storyboarding before coding, building shot by
  shot, and checking work through contact sheets rather than full-size stills (see `docs/WORKFLOW.md`); and the
  WebGL `UNMASKED_RENDERER_WEBGL` probe of its `gpu_probe.mjs`, adapted into `launch()` in
  `engine/app/scripts/lib.ts` (every browser the scripts start logs its renderer and refuses software WebGL).

### MIT License text (applies to both works above, with their own copyright lines)

```
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### npm dependencies

Installed by `bun install`, not vendored: three.js (MIT), opentype.js (MIT), Vite (MIT), playwright-core (Apache-2.0),
TypeScript (Apache-2.0). See each package's licence in `node_modules/`.

**manim-web** (pinned to 0.40.1): https://github.com/maloyan/manim-web, npm `manim-web`. Copyright (c) 2025 Narek Maloyan. MIT License (same text as above). A TypeScript port of the Manim
Community API, used as a drawing and animation layer through `engine/app/src/scenes/_manim.ts`; not vendored, not
modified. Its transitive dependencies include MathJax (`@mathjax/src`, Apache-2.0) with the New Computer Modern math
font data (`@mathjax/mathjax-newcm-font`, Apache-2.0), KaTeX (MIT), jsPDF (MIT), lottie-web (MIT), html2canvas (MIT),
typia (MIT), earcut (ISC) and polygon-clipping (MIT). Rendered formulas are glyph outlines of that font.

## Fonts (`engine/app/public/fonts/`)

See `engine/app/public/fonts/LICENSES.md`. Summary: Archivo (Omnibus-Type), Cormorant Garamond (Christian Thalmann)
and IBM Plex Mono (IBM) under the SIL Open Font License 1.1 (`fonts/src/OFL.txt`); the EMS stroke fonts (Sheldon B.
Michaels, SVG by Windell H. Oskay) under the SIL OFL; the Hershey stroke fonts (A. V. Hershey, SVG by Windell H. Oskay)
under the Hershey fonts' permissive use terms reproduced in each SVG's metadata.

## Reference art (`engine/app/public/refs/`)

Every file, with author, licence and source URL, is listed in `engine/app/public/refs/SOURCES.md`. Licences present:

- **Servier Medical Art** (https://smart.servier.com), via Bioicons: **CC BY 3.0**. Attribution required on screen or in
  the video description.
- **DBCLS** (Database Center for Life Science), via Bioicons and Wikimedia Commons: **CC BY 4.0**. Attribution required.
- **Bioicons CC0 items** (Fabian Mikulasch, Emily A. Daniel, Marcel Tisch): **CC0 1.0**. Credit appreciated, not required.
- **Gray's Anatomy (1918)** plates by Henry Vandyke Carter; *Zoology of the Voyage of H.M.S. Erebus & Terror*
  (1844-75); Mikael Häggström's human skeleton: **public domain**.

`examples/refart-kidney/` holds a public-domain Gray's Anatomy plate (fig. 1127, Wikimedia Commons) and the cleaned and
traced images derived from it; its `SOURCES.md` gives the source URL.

No share-alike, non-commercial or copyrighted images are included. Pages of scientific papers are never part of this
repository; an episode that shows them stores them in its own (git-ignored or private) folder and relies on its own
legal basis (quotation for commentary); see `docs/WORKFLOW.md`.
