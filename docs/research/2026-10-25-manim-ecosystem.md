# Manim ecosystem and alternatives: what to borrow for 3b1b-style math (2026-10-25)

Everything in the tables was checked on 2026-10-25 with `gh repo view` or `gh api` (stars, `licenseInfo`, `pushedAt`,
latest release), and some licence files were read directly. Star counts are a snapshot. **Unverified** marks anything
that could not be confirmed. Nothing was installed.

Our engine for comparison: `engine/app` is TypeScript, Vite, `three@^0.186`, `opentype.js@^2`, Playwright and
WebCodecs. The repo is MIT (`LICENSE`, `THIRD_PARTY.md`).

## 1. Manim itself

| Repo | Stars | License | Last push / release | What it gives us |
|---|---|---|---|---|
| [3b1b/manim](https://github.com/3b1b/manim) (ManimGL) | 95,650 | MIT | push 2026-09-09; last release v1.7.2, 2024-12-13 | Grant Sanderson's own engine. It renders through OpenGL in an interactive window, and its live-reload workflow suits a human author. It has no CI-grade docs or tests. Its README itself points newcomers to CE. |
| [ManimCommunity/manim](https://github.com/ManimCommunity/manim) (ManimCE) | 41,862 | MIT | push 2026-10-25; v0.22.0, 2026-10-08 | Community fork (2020). Stable, documented, tested API, and the plugin ecosystem targets it. The Cairo renderer is CPU-only and fully headless. CLI has `-t/--transparent` and `--format {png,gif,mp4,webm,mov}`. Supports full LaTeX (needs a TeX install) and Typst. |

**How they differ:** they share the original API, but the codebases diverged in 2020 and the two are not
interchangeable (the ManimGL README warns against mixing the install instructions). GL is fast and interactive but
needs a GL context. CE is slower (Cairo) but headless, versioned and documented, and it is what LLMs have mostly seen.

**For headless/batch rendering and agent-written code, CE wins clearly.** It has stable docs, a pip release cadence,
plugins, transparent WebM/MOV output from one flag, and no display needed. Nearly every agent/LLM manim project below
targets CE.

## 2. 3b1b/videos

| Repo | Stars | License | Last push | What it gives us |
|---|---|---|---|---|
| [3b1b/videos](https://github.com/3b1b/videos) | 11,410 | **CC BY-NC-SA 4.0** (read `LICENSE.txt` and README) | 2026-09-29 | Scene code for every video, 2015 to 2026, written against **ManimGL**. `_2024/transformers/` holds the LLM series code: `attention.py`, `embedding.py`, `mlp.py`, `auto_regression.py`, `generation.py`, `ml_basics.py`, `network_flow.py`, `almost_orthogonal.py`, `helpers.py`, `supplements.py`, `chm.py`. |

**Licence consequence:** NonCommercial plus ShareAlike. We **cannot vendor or port this code into an MIT repo**, and
a monetised trailer must not reuse it. We may read it to learn how attention and embedding visuals are staged
(ideas are not copyrightable), then write our own implementation. Do not copy code, and do not copy distinctive
assets such as his pi creatures.

## 3. Forks, plugins and creator code

| Repo | Stars | License | Last push | What it gives us |
|---|---|---|---|---|
| [ManimCommunity/manim-voiceover](https://github.com/ManimCommunity/manim-voiceover) | 322 | MIT | 2026-06-15 (v0.4.0, 2026-06-14) | **Yes, it supports ElevenLabs** (`services/elevenlabs.py`, `examples/elevenlabs-example.py`). It also supports Azure, OpenAI, Gemini, gTTS, pyttsx3 and a recorder. Bookmark/word timing comes from **Whisper transcription** (`transcription_model`), not ElevenLabs' native alignment. Our existing word cues are already better than that. Useful as a design reference, not as a dependency. |
| [helblazer811/ManimML](https://github.com/helblazer811/ManimML) | 3,523 | MIT | **2024-06-22 (stale)** | CE-based NN animations (feed-forward and conv layers, forward passes; module list from memory, **not re-checked**). Usable as reference, risky as a dependency. |
| [Matheart/manim-physics](https://github.com/Matheart/manim-physics) | 411 | MIT | 2026-10-15 | CE plugin: rigid bodies (pymunk), electromagnetism, waves, pendulums, lenses. |
| [jeertmans/manim-slides](https://github.com/jeertmans/manim-slides) | 968 | MIT | 2026-10-24 (v5.7.0) | Turns CE/GL scenes into live slide decks. Not relevant to rendering video. |
| [kilacoda/chanim](https://github.com/kilacoda/chanim) (was raghavg123/chanim, redirects) | 179 | MIT | **archived**; push 2026-01-12 | Chemistry plugin. Archived, so skip it. |
| [maecdch/ManimTransformer](https://github.com/maecdch/ManimTransformer) | 3 | none stated | 2026-03-06 | The only "manim transformer" hit. It is trivial and has no licence, so it is not usable. **No serious open transformer/LLM explainer on manim exists besides 3b1b/videos (NC).** |
| [ManimCommunity/awesome-manim](https://github.com/ManimCommunity/awesome-manim) | 541 | none | 2026-10-07 | Creator directory, useful for finding more creator repos. |
| **Agent/LLM manim tools** | | | | |
| [HarleyCoops/Math-To-Manim](https://github.com/HarleyCoops/Math-To-Manim) | 2,806 | MIT | 2026-10-23 | Text/image to CE code with an agent pipeline. Shows the prompting patterns. |
| [TIGER-AI-Lab/TheoremExplainAgent](https://github.com/TIGER-AI-Lab/TheoremExplainAgent) | 1,513 | MIT | 2025-07-27 | ACL 2025: agentic long-form manim explainer plus a benchmark. Useful for its failure taxonomy of agent-written manim. |
| [adithya-s-k/manim_skill](https://github.com/adithya-s-k/manim_skill) | 1,213 | MIT | 2026-01-23 | Agent skills for manim. We could crib its structure for our own `skills/`. |
| [abhiemj/manim-mcp-server](https://github.com/abhiemj/manim-mcp-server) | 654 | MIT | 2025-05-19 | MCP wrapper around CE rendering. |
| [academa-labs/manimgx](https://github.com/academa-labs/manimgx) | 2,116 | MIT | 2026-10-25 | CE-API-compatible engine with a Rust/wgpu core, on PyPI and npm ("run in the browser"). Its README claims 90x faster than CE (its own benchmark, **unverified**). **Created 2026-10-05, so it is three weeks old.** Watch it, but do not depend on it yet. |
| [AzurIce/ranim](https://github.com/AzurIce/ranim) | 657 | MIT | 2026-10-24 | Rust manim-inspired engine. Not our stack. |
| **Creators who published code** | | | | |
| [nipunramk/Reducible](https://github.com/nipunramk/Reducible) | 674 | **none (all rights reserved)** | 2022-08-01 | Real. All Reducible video code. Read-only reference; we cannot copy it. |
| [vivek3141/videos](https://github.com/vivek3141/videos) (vcubingx) | 192 | **none** | 2024-05-24 | Real. ManimGL code for vcubingx videos. Read-only reference. |
| [vivek3141/dl-visualization](https://github.com/vivek3141/dl-visualization) | 217 | **none** | 2024-05-27 | Real. "Visualizing Deep Learning" series code. Read-only reference. |
| [ArtemKirsanov/Youtube-Videos](https://github.com/ArtemKirsanov/Youtube-Videos) | 166 | **none** ("Copyright 2023") | 2025-02-13 | Real, but it is Python plotting code, not manim (he works mostly in Blender, see [BlenderSpike](https://github.com/ArtemKirsanov/BlenderSpike), MIT, 213 stars). |
| Mathemaniac | n/a | n/a | n/a | **Unverified / not found.** The GitHub account `mathemaniac` has no public repos, and no code repo was found. Treat as unpublished. |

## 4. TypeScript / browser alternatives (our stack)

| Repo | Stars | License | Last push / release | What it gives us |
|---|---|---|---|---|
| [maloyan/manim-web](https://github.com/maloyan/manim-web) | 497 | MIT | 2026-10-25 (v0.40.1, 2026-10-24) | **Most relevant find.** A TypeScript port of the ManimCE API (claims 429/429 "feasible" CE 0.22 symbols, see its PARITY.md). It is built on **three@^0.186 and opentype.js@^2, the same versions as our engine**. LaTeX goes through KaTeX (a subset) or MathJax, and Typst is optional. Includes `Timeline.seek(t)`, a WebCodecs exporter, plus geo/chem/bio modules. Caveat: it is young (created 2026-01-29) and effectively one maintainer (685 of ~950 commits). |
| [motion-canvas/motion-canvas](https://github.com/motion-canvas/motion-canvas) | 19,481 | MIT | push 2026-07-02; **last release v3.17.2, 2024-12-14** | Generator-based TS animation with a built-in `Latex` component (MathJax) and an editor. Canvas2D with its own renderer and scene graph, so it does not fit our WebGL compositor. Releases have slowed. |
| [midrender/revideo](https://github.com/midrender/revideo) (was redotvideo/revideo) | 4,143 | MIT | 2026-07-15; no GitHub releases | Motion Canvas fork with a headless render API, now the engine behind Midrender. Same architectural mismatch as Motion Canvas. |
| [remotion-dev/remotion](https://github.com/remotion-dev/remotion) | 67,379 | **Remotion License (source-available, not OSI)** | 2026-10-25 (v4.0.538) | React video. Free for individuals, orgs with 3 or fewer employees, and non-profits. Bigger companies need a paid company licence. It **forbids selling or relicensing a derivative of Remotion**. **Do not use it as a dependency in an MIT repo**; downstream users would inherit the licence. |
| [theatre-js/theatre](https://github.com/theatre-js/theatre) | 12,798 | Apache-2.0 | **2024-08-14 (stale)** | Keyframe editor for three.js/DOM. Licence-compatible, but there has been no activity for 14 months. Not math-specific. |
| [stevenpetryk/mafs](https://github.com/stevenpetryk/mafs) | 3,444 | MIT | 2025-03-30 | React SVG components for interactive math (coordinate planes, plots, vectors). Good reference for plot primitives. |
| [unconed/mathbox](https://github.com/unconed/mathbox) | 1,505 | MIT | 2023-05-05 (stale) | three.js-based "presentation-quality" math graphing by Steven Wittens. Gold-standard reference for coordinate systems in WebGL. Not maintained. |
| [JazonJiao/Manim.js](https://github.com/JazonJiao/Manim.js) | 453 | **none** | 2026-08-22 | p5.js manim imitation. Has no licence, so we cannot use it. |

## 5. Solar system / orbital data

| Source | Stars | License | Status | What it gives us |
|---|---|---|---|---|
| [cosinekitty/astronomy](https://github.com/cosinekitty/astronomy) (npm `astronomy-engine`) | 1,071 | MIT | push 2025-01-27; v2.1.19, 2023-12-14 (npm matches) | Pure-JS planet, Moon and Sun positions with no network, accurate to about ±1 arcminute. Gives heliocentric vectors (`HelioVector`), eclipses and transits. **Best fit:** deterministic at render time, offline, and MIT. It is mature and the low churn is fine. |
| NASA JPL Horizons API (`ssd.jpl.nasa.gov/api/horizons.api`) | n/a | US-government data (public-domain usage norms) | **Live-tested 2026-10-25**: returned a JSON vectors ephemeris for Mars | Authoritative ephemerides and spacecraft trajectories (e.g. Voyager, Artemis). Fetch once at build time and cache to `engine/data/`; never call it at render time. |
| [mrdoob/three.js](https://github.com/mrdoob/three.js) | 116,916 | MIT | 2026-10-25 (npm 0.186.1) | Already our dependency. Its examples cover orbit lines (`Line2`/fat lines), instanced stars, bloom and CSS2D labels. |
| [Javilop/artemis-ii-tracker](https://github.com/Javilop/artemis-ii-tracker) | 56 | MIT | 2026-04-06 | Small worked example of three.js plus a Horizons trajectory. |
| [SoumyaEXE/3d-Solar-System-ThreeJS](https://github.com/SoumyaEXE/3d-Solar-System-ThreeJS) | 105 | MIT | 2025-11-28 | Toy three.js solar system (textures, orbits). Visual reference only. |

Recommendation for the trailer's solar-system beat: `astronomy-engine` positions, a time variable driven by our scene
clock, three.js orbits in the engraved-plate line style, and an optional Horizons cache for one spacecraft path.

## 6. Integration recommendation

**Primary: port manim-like primitives into our TS engine, and use manim-web as the reference and possible donor.
Do not embed ManimCE as the main path. Keep CE only as an optional, out-of-tree backend.**

Reasons:

1. **One clock, one look.** Our scenes are seekable functions of time inside one WebGL compositor, with
   post-processing, stroke fonts and ElevenLabs word cues. A Python subprocess producing transparent WebM/MOV clips
   would need its own timing contract (pass word times in, get fixed-length clips out). It would also lose our
   post-processing on the math layer (engraved line style, grain, palette) unless we re-implement that style in CE. It
   breaks per-frame scrubbing in the Vite dev server and in QA contact sheets, and it adds Python, Cairo/Pango and a
   TeX install to a repo meant to be cloned and run.
2. **The stack already matches.** manim-web uses three@0.186 and opentype.js@2, as we do, and is MIT, so copying or
   adapting modules is licence-clean. Attribute it in `THIRD_PARTY.md` the same way we credit pdoom-video. Pick
   targeted pieces (`Axes`/`NumberPlane`, `FunctionGraph`, `MathTex` via KaTeX/MathJax to SVG paths, `Transform`
   point-matching, `TransformMatchingTex`, rate functions) rather than taking the whole dependency. It is young and has
   a single maintainer.
3. **Agent-writability holds in TS too.** Mirror CE names and signatures (`Create`, `Write`, `FadeIn`, `Transform`,
   `ValueTracker`, `always_redraw` to `updater`) so an LLM's manim knowledge transfers directly. Cue animations to
   word timings with our existing cue API (`at(cue("attention"), Transform(a, b))`).
4. **LaTeX:** MathJax 3/4 SVG output gives real glyph paths, which we can morph and stroke-draw. KaTeX is lighter but
   renders HTML/CSS, which is harder to animate as paths. **Prefer MathJax SVG to path geometry.** This is what
   manim-web and Motion Canvas do.
5. **Optional CE backend (phase 2, only if needed):** a `tools/manim_clip.py` that renders a CE scene with
   `-t --format webm` (VP9 alpha), with the scene's duration set from the cue JSON. Composite it as a video texture.
   It is licence-clean (CE is MIT). Use it only for things the port lacks, such as heavy LaTeX packages or
   manim-physics.

**Licence summary for an MIT repo:**
- OK to depend on or adapt (keep notices): ManimCE, ManimGL, manim-voiceover, ManimML, manim-physics, manim-web,
  Motion Canvas, Revideo, mafs, mathbox, three.js, astronomy-engine (all MIT), and Theatre.js (Apache-2.0, needs a
  NOTICE).
- Read-only, no copying: 3b1b/videos (CC BY-NC-SA 4.0), and Reducible, vcubingx and Kirsanov repos (no licence).
- Avoid as a dependency: Remotion (source-available licence with company tiers and a no-relicensing clause).

**Trailer mapping:** LLM internals means our own attention/embedding scenes, staged after studying (not copying)
`3b1b/videos/_2024/transformers`. The solar system uses astronomy-engine plus three.js. Animated plots use ported
Axes/FunctionGraph/ValueTracker. Paper explainers use our existing paper-screenshot pattern. Multiple voices use
ElevenLabs multi-voice cues, which the engine already handles.
