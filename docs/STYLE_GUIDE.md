# Style guide — preset: "engraved treatise"

> **This is one style preset**, the default the engine and kits were built for: plates from an illustrated
> scientific treatise, cut for a TV across a room and a phone in the hand. Another look is possible (new palette,
> new kits, new rules), but then write its own guide and keep `scripts/qa.ts`'s thresholds in sync with it.

It was refined on owner feedback after watching finished episodes on a large TV: the first cuts **undersold**
(hedged, overcautious), **the text was too small** when there was free space, and several **Shorts cut text off**.
The rules below are the fixes. Tone has its own document: `docs/TONE.md`.

## A. The look

- **Hairline engraved plates.** Thin outlines plus parallel hatching whose density follows the tone (dark = dense),
  like a 19th-century treatise. Plates alternate between **ink** (near-black) and **bone paper**; the camera is
  always moving (slow push, drift), and shots crossfade on one camera.
- **Anatomy and objects come from real references**, not memory: `engine/app/public/refs/` (Servier Medical Art,
  Bioicons, DBCLS, Gray's Anatomy, other public-domain plates), restyled at runtime by `_refart.ts`. The geometry is the
  reference's own. New art is logged with its licence in `refs/SOURCES.md` in the same commit. Animals and scenes:
  engraved-style line art traced from a CC/PD reference, or a simple silhouette.
- **Never draw anatomy procedurally.** If the library lacks the view you need (a cross-section, a cell type), in this
  order: find a CC/PD vector (`refart find`); take a public-domain plate, remove its printed labels by inpainting
  (`refart clean`, never rectangles) and trace it (`refart trace`); otherwise stop and ask the orchestrator for an
  asset agent. "Consulted a reference, then drew it in code" is not a reference. Schematic glyphs (molecules, arrows,
  dials) may be drawn in code.
- **Reads.** One new thing to read at a time; lead the eye to where a reveal will happen before it happens; hold key
  numbers long enough to read twice.
- **Typography:** mono (IBM Plex Mono) for labels, kickers and citations; serif (Cormorant Garamond) for statements;
  sans (Archivo) for headlines, numbers and captions. A FIG. kicker (`FIG. 3 · TITLE`) heads each plate.
- **Schematics say so.** A drawing a viewer could mistake for data carries a small, low-contrast "SCHEMATIC" label
  (`schematic()` in `_devices.ts`); curves drawn for shape only say "shape, not data".
- **Banned:** cartoons, mascots, faces, city/factory metaphors, neon, fear imagery, stock-photo looks, invented data.

### Colour code (`engine/app/src/engine/palette.ts`)

| Key | Hex | Role |
|---|---|---|
| `ink` | `#0A0A0B` | background black, type on paper |
| `bone` | `#EEE9DF` | paper, type on ink |
| `graphite` / `ash` | `#5E5B57` / `#9C978F` | secondary lines and text |
| `signal` | `#FF9124` | **the one thing that glows.** Drawn on the signal layer (`Layers.sig`), the only layer pushed into bloom. Pick one protagonist per series (the molecule, signal or object the series follows) and give nothing else this colour. |
| `ember` / `blood` | `#FFC070` / `#B5560E` | hotter core of the signal; signal on paper |
| `ochre` | `#CDA463` | a warm secondary in the signal's family that **never** blooms |

Secondary actors get muted, desaturated colours that never glow (slate, rose-grey, blue-grey; e.g. `#8E9AAE`,
`#A8959C`, `#7F97A6`). One colour per actor for the whole series; write the map in the episode brief.

## B. Type scale (1920×1080 canvas, minimums)

Use the free space: when a plate has room, the text grows. Prefer fewer words per plate to smaller type.

| Element | Minimum |
|---|---|
| Key number or headline of a plate | 96 px |
| Serif callouts and statements | 44 px |
| Labels on diagrams (mono or sans) | 30 px |
| Chart axis labels and values | 30 px |
| Small annotations, FIG. kicker, scale bars, citation lower-third | 24 px |
| Translation panel text | 40 px; the panel may take up to 60 % of the frame width |
| Protocol cards: title / body | 56 px / 36 px |
| A real paper page during its proof moment | at least 55 % of the frame height |

Sizes are on-screen pixels after camera zoom (qa multiplies by the zoom). `_devices.ts` `T` holds the scale:
`T.H 104 · T.S 50 · T.L 32 · T.A 24 · T.TR 42 · T.CB 38 · T.CT 60`.

## C. Captions

Burned in at the bottom, centred, Archivo 38 px, two lines at most; the bottom of the frame (y > ~928) belongs to
them. Scenes keep text baselines above about y 900. Numbers spoken in words are shown as digits; phonetic acronyms as
the acronym (`tools/make_captions.py`).

## D. Vertical Shorts safety

- For every line inside a `short` unit, **all text and the key action sit inside the central square x 420–1500**.
  The side margins hold decoration only. (`SQ` in `_devices.ts`; `fig2()` puts the kicker inside the square.)
- `scripts/qa.ts` reports any text crossing x 420 / x 1500 on Short lines (`square`), and the contact sheet draws the
  guides in red on those tiles. Fix and re-check; a Short with a cut word is not shippable.
- The Short itself (`tools/make_shorts.py`) is the square in the middle of a 1080×1920 ink canvas, a hook title
  above, big word-timed captions below, a thin progress rule in the accent colour.

## E. Recurring devices (in `_shots.ts` / `_devices.ts`)

- **Paper moment:** use `paperBeat` (`_papers.ts`). The real page fills a large window (≥ 55 % of the frame height) for
  at least 2.5 s while a graphite highlighter sweeps the quote, with a citation lower-third; then, outside a Short,
  the translation panel takes a right-hand column (38 % of the width, text ≥ 40 px) and the plate keeps the other 60 %
  at full height; inside a Short it goes page → panel → plate in sequence, never sharing the square. A ~380 px strip
  under a full-width panel is too small on a TV. The helper returns the rect the plate may use and logs a
  `[paperBeat]` error (a qa `cue`) when the quote breaks its budget: ≤ 30 words and ≤ 3 numbers per panel, Shorts
  ≤ 20 words or a `tr_short`. Fix the quote (`tr_panel`), not the timing. Lower-level parts: `PaperView`,
  `paperKeys`, `highlight`, `transPanel`, `holdFor`, `citeBar`.
- **Math:** formulas, axes and plots come from the manim-web layer (`_manim.ts`: `MathTex`, `Axes`, `plot`,
  `Create`/`Write`/`Transform`), started on word cues like everything else. Colours from the palette (`MC`); the
  formula is part of the plate, so it follows the same type floors (a 76 pt MathTex reads like 96 px headline type).
- **Protocol cards** (`protocolCard`, numbered `n / N`): calm, typeset, one per safety statement, with its bucket tag
  (`bucketTag`: contraindicated · requires monitoring · under-studied · implementation error). Complete sentences that
  match the narration word for word.
- **Leaders and stamps** (`lead`, `stamp`, `crossOut`): a stamp or cross-out is for a myth the *critics* hold, never
  for a claim from our own side (see `docs/TONE.md`).
- **Qualifier labels:** where the species or system matters, one plain caption-style label ("in mice", "in cells"),
  said once. **No evidence-tier tags** on plates (MEASURED IN HUMANS / IN ANIMALS / HYPOTHESIS …): they turn the
  episode into an audit.

## F. Rendering defaults

1920×1080, 30 fps, 4 motion-blur sub-frames over a 0.4 shutter, H.264 CRF 18 with `-tune grain`, AAC from the master
narration. Post (`engine/post.ts`): bloom on the signal layer only, grain, vignette, a little halation and chromatic
aberration on ink plates; paper plates get less of each.
