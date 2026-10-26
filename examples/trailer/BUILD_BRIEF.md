# trailer build brief v2 (scene builders): «vibe-animator: launch trailer»

Dev server **http://localhost:5730** (started by the orchestrator; never start your own). Narration is voiced at
tempo 1.1 (`eleven_v4`, four voices, per-line loudness leveling); total **164.3 s**. Timings below come from
`timing.json`; cue by word, never by second. The v1 brief, script, outline and timing are in `v1/` (background only).

Read, in this order, and nothing else broadly:
1. `docs/AGENT_WORKFLOW.md`, Part 1 (binding: the loop, qa, finish without rendering).
2. `docs/STYLE_GUIDE.md` (binding, except where a look below replaces the engraved preset for your chapter).
3. This file.
4. Your pack: `packs/C<N>.md` (lines with timing, speaker, cue word, typed text, visual notes, kit pointers).
5. `engine/app/KIT_INDEX.md` for any other helper; `tools/nx kit examples/trailer show <name>` prints one export.

`OUTLINE.md` (v2: goal-first audit, risks) is background. The v1 scene files in `src/scenes/c*.ts` cue v1 line ids
that no longer exist: rebuild from them, keep what the outline marks *reused*, and delete every stale cue.

## Hard rule (binding, every frame)

**No nutrition, health or medical content. No channel names. No mention of the project this pipeline was built
on.** No footage, thumbnail, caption text or plate from any other video, except the T3 Code captures in
`public/t3/` (audited, below). Every flash frame, preview, cutting-room frame and phone Short is made from *this*
trailer's own chapters. The only numbers on screen are the ones in this brief and the script's visual notes.

## Chapter windows (v2, voiced)

| ch | title | window (s) | length | look | Short |
|---|---|---|---|---|---|
| C0 | What vibe-animator does | 0.50–21.39 | 20.9 s | engraved + T3 window | S01 |
| C1 | A chatbot's next word | 23.09–44.43 | 21.3 s | T3 composer → dark math | S02 |
| C2 | Completing the square | 46.13–79.19 | 33.1 s | T3 composer → watercolor + ink | S03 |
| C3 | P versus NP | 80.89–117.16 | 36.3 s | T3 composer → dark math | S04 |
| C4 | Kepler's page | 118.86–142.88 | 24.0 s | T3 composer → engraved | S05 |
| C5 | How it's made | 144.58–153.83 | 9.2 s | engraved | S06 |
| C6 | Try it | 156.23–161.17 | 4.9 s (+2.5 s hold) | engraved | none |

Line gaps 0.3 s, chapter gaps 0.9 s, plus each line's `hold` (script.json).

## What changed per chapter (from OUTLINE.md v2)

- **C0, new.** Epicycles trace the logo (moved here from the v1 end card); the wordmark writes in on
  `vibe-animator`. The frame opens into the **full T3 Code window** playing the real session (`public/t3/session/`,
  about 7 s), with kicker **REAL SESSION IN T3 CODE · CLAUDE HAIKU 5.5 · 25 S SHOWN IN ~7 S** (≥ 24 px) and the
  credit tag «T3 Code» bottom-left; four engraved chips (SCRIPT, VOICES, ANIMATION, SHORTS) pop in on their words.
  Then the window dissolves to its composer only: **four composer cards** with the four prompts, and the **FLIP
  previews** (spec below). On `law` the camera pushes into card 1, which becomes the C1 composer.
- **C1, small changes.** Opens in the T3 composer (C1-L8 typed, lift-out). New: an empty slot with a «?» after
  «tired»; the probability bars race *in that slot* and the picked bar drops into the sentence (C1-L7). Kept: the
  embedding cloud (C1-L2) and the attention line with the ILLUSTRATIVE tag (now C1-L6, cue the quoted `it`).
- **C2, rebuilt.** Goal first: a square with a «?» side, a 10-by-? strip and «= 39» (C2-L9, `side`). The insight
  before any move: a small demo square, area 64 → side 8 (C2-L12, `eight`), which then stays small in a corner, and
  a **dashed outline** of the target square that stays through every move. C2-L13: the 10 strip bumps the outline
  («does not fit»), splits on `Split`, the halves swing onto two sides, the 5 × 5 gap glows amber with «25» on
  `corner`. C2-L14: on `Fill` the corner fills and the square locks into the outline (insight sting), «39 + 25 = 64»
  writes (not spoken), the demo flashes 64 → 8, the side splits 5 + 3 and the 3 lands on the «?». C2-L7 (reused
  audio): «centuries later» caption first, then the same pieces get letters *in place* (10 → b, half → b/2, corner
  → (b/2)², 39 → c), assembling x = √((b/2)² + c) − b/2, then the textbook formula, labelled «same recipe, general
  form». Kept: the watercolor courtyard, the half-strip swing, the amber corner.
- **C3, rewritten and re-ordered.** C3-L11: a filled sudoku ticks green within a second (stopwatch «1 s»); on `fast`
  an empty grid with a stopwatch «?». C3-L12: the empty grid grows, a search tree branches one level per empty
  square; on `multiply` the n², n³, 2ⁿ race starts. C3-L13: n²/n³ light amber, 2ⁿ dims, «polynomial time» writes on
  `polynomial`, the goal question returns as text, the definition writes on `yes`. Then $1M card (`million`) and the
  two AI cards stamped «not P vs NP» (`mathematics`). Kept: grid, curve race, cards.
- **C4, rewritten.** Goal first (C4-L7): six orbits, a ruler on Mars's distance, a clock ticking its year that stops
  on «?» at `year`. C4-L8: the page or typeset card on `1619`, the highlight and translation panel, then the
  4× / 8× two-orbit gloss on `longer` (clocks read 1 and 8). C4-L9: log-log axes with ticks 1, 10, 100 visible,
  Mercury–Saturn dots snap to slope 1.5 on `sit` (insight sting), *praecise* (exactly) stamped as Kepler's word.
  **Removed:** the equal-areas wedge.
- **C5, trimmed.** C5-L6: plan node fans out to 9 agents on `nine`, owner numbers on screen. C5-L9: cutting room,
  vertical crop, captions on `captions`, generic phone swipes three Shorts. **Removed:** the render-timeline beat.
- **C6, one line.** Strip winds onto the reel, the C0 logo returns (**no second epicycle trace**),
  github.com/Fr4nzz/vibe-animator writes in on `GitHub`, end card and credits.

## The three looks

| Look | Chapters | What it is |
|---|---|---|
| **Engraved plate** (house style) | C0, C4, C5, C6 | `docs/STYLE_GUIDE.md` as written: hairline cross-hatched linework, bone paper plates (`paper: 1`), `signal` amber as the one glow, `blood` for signal on paper. |
| **Dark math** (a 3b1b-*like* look) | C1, C3 | Ink plates (`paper: 0`), glowing vector strokes on the signal layer, formulas and axes through the **manim-web layer** (`scenes/_manim.ts`). One amber protagonist per plate. |
| **Watercolor wash + clean ink geometry** | C2 | A soft watercolour wash for the courtyard and the two figures (public-domain reference art via `refArt` / `refart`), the geometry in crisp hairlines, the 5 × 5 corner in amber. |

**Originality (binding):** no 3Blue1Brown code, assets, fonts, colour files or scene layouts. manim-web (MIT) is
credited in the end card.

## T3 Code assets (`engine/app/public/t3/`)

All frames come from an **isolated** T3 Code instance (own home and port, loopback only, a clean copy of this repo, no
model run for the four prompts). Privacy audit: OCR of every frame plus the page's DOM text against
a private blocklist of topic, channel and personal terms → **0 hits** (265 frames). Frames are 1920 × 1080 WebP
(q 90), plus a 2× re-capture of the composer region (`hi/`, deviceScaleFactor 2, same instance and layout, never
sent; OCR + DOM audit 0 hits again), about 11 MB in all (cap ~15 MB). Load with `loadImg(url)` from `_shots.ts` (cached promise, decode once) and preload every
frame you use in `init`, never in `render`.

### Typed prompts: `t3/<lineid>/` for `C1-L8`, `C2-L8`, `C3-L7`, `C4-L5`

`t3/<lineid>/index.json`:

```json
{ "line": "C1-L8", "prompt": "Explain how a chatbot picks its next word.", "chars": 42,
  "size": [1920, 1080], "composer_bbox": [721, 469, 734, 142], "text_origin": [737, 486],
  "frames": [ { "file": "000.webp", "chars": 0, "caret": [745, 486, 19], "sha1": "…" }, … ] }
```

- `frames[k]` shows the first `k` characters typed, `k = 0 … chars`; then **3 settle frames** (`chars` = all, the
  same picture; use them for the hold). Pick the frame by the typed prefix length:
  `frames[Math.min(this.q.typed(id, t).length, chars)]`. Deterministic; never by time.
- `composer_bbox` = `[x, y, w, h]` in frame px: the composer card (rounded box, model / effort / access row
  included). It is the same in every frame of all four prompts. Push into it, or crop it with
  `drawImage(img, x, y, w, h, …)` for the C0 cards.
- `caret` = `[x, top, height]` of the text end in frame px (`null` if unknown). **Screenshots hide the real caret**:
  draw your own (1.5 px bone bar, `Math.floor(t * 2) % 2` blink) at `caret` while the line types.
- `text_origin` = top-left of the prompt text (T3's sans, about 15 px tall in the frame, line top y 486).
- Page: T3's new-thread draft ("What should we build in vibe-animator?"), sidebar with one older thread, environment
  label `t3-trailer`. The composer sits at y 469–611, **above the caption band**; on the thread page (C0 session) it
  sits lower, see below.
- `sha1` per frame exists so that `index.json` changes whenever a frame changes: name `'t3/<lineid>/index.json'` as a
  string literal in your scene so the render receipt hashes it (frame paths built at run time are not seen by it).

### Real session: `t3/session/`

`t3/session/index.json`: `fps` 12, `count` 84, `duration` 7.0 s, `segments` (output seconds ← source seconds),
`key_frames` (0-based): typing 4–22, sent 23, working 24–65, **Running grep 39–44**, **Running nx 55–65**,
**final answer 66–83** («Worked for 25s», `TOTAL 0`). Piecewise retime of the 48 s recording: page 0–0.4 s, typing
0.4–2.0 s, «Working» 2.0–5.6 s (about 7× speed), the answer 5.6–7.0 s. Play it with
`frame = clamp(Math.floor((t - this.q.s('C0-L7', 'You')) * 12), 0, 83)` so it runs 3.19–10.19 s and holds the final
answer through the hold. Before the send the composer is centred (`composer_bbox_before_send` [721, 469, 734, 142]);
after it the composer drops to y 916–1060 (inside the caption band): keep the window scaled so that it stays above
y 928 on screen, or crop the bottom off.

## The re-typed tag (owner decision, 2026-10-25, binding)

The four prompts in C1–C4 were re-typed for the trailer with no model run behind them. While a T3 composer is on
screen in **C1, C2, C3, C4 and the C0 cards**, draw a small honest tag: **«prompt re-typed for this trailer»**.
**≥ 24 px on screen after zoom** (qa `size`), `ash` / muted, about 60 % alpha, sans or the kicker face, no box. Place
it just under the composer's bottom-right corner, inside x 420–1500 and above y 900. It appears with the first typed
character and dissolves with the UI. In C0 one tag under the card column covers all four cards.
The **C0 session footage keeps its own kicker «REAL SESSION IN T3 CODE»** and gets no re-typed tag: it is real.

## Composer → title lift-out (C1, C2, C3, C4; one shared kit)

One shared kit, **`engine/app/src/scenes/trailer_t3_kit.ts`**, owned by the **C0 builder**, written *first* (with
the film-strip kit already in place), so C1–C4 import it read-only. Suggested API (pure functions of `t`):
`t3Frames(lineId)` (load + index), `t3Typed(o, t, lineId, view)` (frame by prefix + own caret + re-typed tag),
`t3Lift(o, t, lineId, opt)` (the lift-out), `t3Keys(lineId)` (camera keys). Timing per prompt line `L`, with
`s = q.s(L, first word)`, `cue = q.w(L, cue_word)` end, `e` = line end, `h` = its hold (0.8 s):

1. **Arrive** (chapter intro, before `s`): the film strip's slide-on lands on frame `000` of `L` at z 1, full window.
   (C1 instead arrives from C0's push into card 1, see FLIP.) Composer empty.
2. **Type** (`s` → `e`): frame by `q.typed(L, t).length`, own caret, tag fades in on the first character. The camera
   pushes in continuously, eased, from the full window (z 1) to a **text-centred view**: centre on the middle of the
   prompt text (`text_origin` to the final `caret.x`, y ≈ 496), **z ≈ 2.2** at `e` (UI glyphs then read about 33 px;
   the prompt line spans at most about 700 px, inside x 420–1500). The composer chrome may cross the square; the text
   may not.
3. **Lift-out** (`cue` end → `e + h`, about 0.9 s): at `cue` end draw the prompt as **scene text** over its glyphs
   (same string, same apparent size and position: origin `text_origin` times the camera), and cover the image glyphs
   with the composer's own fill (sample the pixel, `#101010` in these frames). Then the scene text scales up and travels to the
   chapter's **title position** (top band, about y 120–170, ≥ 44 px serif or the chapter's title style, centred in
   x 420–1500) over 0.7 s `ease.inOutCubic`, with a small upward overshoot-free arc. The title stays as the plate's
   title (it may shrink to kicker size later in the chapter).
4. **Dissolve** (overlapping 3, 0.5 s): the T3 frame and the tag fade out while the chapter's plate fades in under
   it, and the camera eases back to the plate's working view. No hard cut, no flash.

### Kit API (written; `trailer_t3_kit.ts`, header has a worked example)

```ts
const t3 = await t3Line(this.q, 'C1-L8', 'word', { title: { paper: 0 } });   // build(): loads every frame + timing
this.shots = [
  t3.shot({ t0: ctx.start }),     // arrive → type (+push) → lift → dissolve; paper 0, fo 0.5, own cam, tag, caret
  { t0: t3.tm.dis1, fi: 0.5, paper: 0, …, hud: (o) => { t3.title(o); … } },  // your plate: draws the title from dis1
];
```
- `t3.tm` = `{ s, e, cue, lift0, lift1, dis0, dis1 }`: `lift0 = max(cue end, line end)` (never lifts a half-typed
  line; C4-L5's `page` is not its last word), `lift1 = lift0 + 0.8` (= e + hold), `dis0 = lift0 + 0.35`, `dis1 = dis0 + 0.5`.
- `shot({ t0?, cam?, drift?, paint?, extraHud? })`: `cam` = arrival keys put before the kit's (C2–C4: `inCam(hi)`);
  `paint(o, p)` wraps the frame painter, e.g. inside the strip's `inner` for frame 0 (`translate(x, y); p(oo)`).
  Handheld drift goes to 0 by `e - 0.2` so the lifted text sits exactly on the glyphs.
- Title options (`title:`): `paper` (0 bone / 1 ink colour), `y` (baseline, default 150), `size` (default 60),
  `font` (another face crossfades in during the travel; default the prompt's sans), `color`, `shrink: {t0, t1, size, y}`
  (to kicker size later), `out: [t0, t1]`. `t3.titleAt(o)` gives the geometry if you draw your own.
- Low level: `t3Frames(id)`, `t3FrameIdx(seq, q, t, untype?)`, `t3Draw(c, seq, k, x, y, s, a, cover)` (1× frame + 2×
  layers), `t3Composer(c, seq, k, x, y, w, h)` (composer crop, 2×), `t3Caret`, `t3Tag(c, x, y, a)`, `t3View`, `t3Keys`,
  `T3_TAG`, `T3_Z`. World = frame px in the T3 shot (frame drawn at 0,0, z 1 = full window).
- **2× layer:** `index.json` `hi` = `{ scale: 2, bg, clip }`: `hi/bg.webp` (the static region the z 2.2 view sees) and
  `hi/NNN.webp` per frame (the composer region). The kit draws them over the 1× frame; you never load them yourself.

Text inside the T3 frames is image text: qa does not see it, so keep it inside the square by construction (step 2).
Captions start with the voice at `s`; nothing T3-related may sit below y 928 once a caption is up.

## FLIP previews in C0 (C0-L10)

- **Cards:** at C0-L10 start (11.14 s) the session window dissolves to its composer, which splits into **four
  composer cards** stacked in a column (left half of the square, about x 440–1000, cards about 560 × 108 px with
  12 px gaps), each a crop of `composer_bbox` from the **last frame** of `t3/<lineid>/` (prompt fully typed). An empty
  **preview slot** (16:9, about 300 × 169, hairline outline) sits right of each card, about x 1030–1330. One re-typed
  tag under the column.
- **Previews:** one per phrase, starting on its first word: C1 on `chatbot's` (14.77 s), C2 on `completing`
  (16.30 s), C3 on `P` (17.83 s), C4 on `Kepler's` (20.01 s). Each is a **real full-screen frame** of that chapter
  (C1 the attention line, C2 the filled 8 × 8 square, C3 the 2ⁿ curve, C4 the 1619 page or its typeset card), drawn
  over the whole frame for **0.4 s**, then it **shrinks and flies into its slot in 0.6 s** (`ease.outCubic`; x, y, w
  and h interpolated together from the full-frame rect to the slot rect: a FLIP, **no fade**, no rotation). The next
  preview never starts before the previous lands (the phrases are ≥ 1.5 s apart). The fourth lands at about 21.0 s.
- **Preview images:** `public/t3/previews/C1.webp … C4.webp` (1920 × 1080), made by the orchestrator from the
  finished chapters (`tools/nx stills`) after C1–C4 pass qa. Until they exist, draw a labelled placeholder plate of
  the right look (dark / watercolor / engraved) with the chapter title; do not render other chapters yourself.
- **Hand-off to C1:** on `law` end (≈ 21.0 s) through the chapter gap (to 23.09 s) the camera pushes into card 1
  until it sits exactly on `composer_bbox` of a full T3 frame, the other cards and the slots fade out, the full C1
  frame `000` fades in around the card, and the card's prompt **un-types** (frames `chars → 0` over the last 0.3 s)
  so C1 starts on an empty composer. C1 starts at z 1 on frame `000` (no film strip into C1).

## Cue words, per line (voiced timings, s)

The bold word is where the line's key animation lands: `this.q.w(lineId, word)`.

| line | speaker | time (s) | cue | text |
|---|---|---|---|---|
| **C0** What vibe-animator does | | 20.9 s (0.5–21.4) | engraved | |
| `C0-L6` | NARRATOR | 0.50–2.39 | **vibe-animator** | This is vibe-animator. |
| `C0-L7` | NARRATOR | 3.19–10.54 | **Shorts** | You describe a video, and Claude Code agents make it: the script, the voices, the animation and the Shorts. |
| `C0-L10` | NARRATOR | 11.14–21.39 | **law** | You are about to see four examples Claude animated: a chatbot's next word, completing the square, P versus NP, and Kepler's third law. |
| **C1** A chatbot's next word | | 21.3 s (23.1–44.4) | dark math | |
| `C1-L8` | DIRECTOR · typed | 23.09–26.07 | **word** | Explain how a chatbot picks its next word. |
| `C1-L2` | NARRATOR | 27.17–33.21 | **space** | A language model turns each word into a point in space, where related meanings sit close together. |
| `C1-L6` | NARRATOR | 33.51–39.11 | **it** | To know what "it" means, the model looks back and pays most attention to "the cat". |
| `C1-L7` | NARRATOR | 39.41–44.43 | **picks** | Then the model weighs every possible next word by probability and picks one. |
| **C2** Completing the square | | 33.1 s (46.1–79.2) | watercolor + ink | |
| `C2-L8` | DIRECTOR · typed | 46.13–48.96 | **square** | Show how al-Khwarizmi completed the square. |
| `C2-L9` | STUDENT | 50.06–54.35 | **side** | A square plus ten of its sides makes thirty-nine. What is the side? |
| `C2-L12` | KHWARIZMI | 54.66–60.47 | **eight** | Make one perfect square. Then the side is easy: area sixty-four, side eight. |
| `C2-L13` | KHWARIZMI | 60.77–67.75 | **corner** | The ten does not fit. Split it: five on two sides. A corner is missing, five by five. |
| `C2-L14` | KHWARIZMI | 68.06–73.87 | **Fill** | Fill it, and the area is sixty-four. Side eight. Take away five: three. |
| `C2-L7` | NARRATOR | 74.17–79.19 | **formula** | He wrote it all in words. Centuries later, the picture became a formula. |
| **C3** P versus NP | | 36.3 s (80.9–117.2) | dark math | |
| `C3-L7` | DIRECTOR · typed | 80.89–84.38 | **sudoku** | Explain P versus NP with a sudoku. |
| `C3-L11` | NARRATOR | 85.48–90.57 | **fast** | Checking a finished sudoku takes a second. Is finding the answer always that fast? |
| `C3-L12` | NARRATOR | 90.87–96.18 | **multiply** | Finding it can mean trying combinations, and they multiply with every empty square. |
| `C3-L13` | NARRATOR | 96.48–106.59 | **polynomial** | Fast means time that grows gently, like n squared: polynomial time. If P equals NP, then yes, finding is fast too. |
| `C3-L10` | NARRATOR | 106.89–111.25 | **million** | Nobody knows. A proof either way wins a million dollars. |
| `C3-L6` | NARRATOR | 111.56–117.16 | **mathematics** | AI might help find that proof. On other problems, it has already found new mathematics. |
| **C4** Kepler's page | | 24.0 s (118.9–142.9) | engraved | |
| `C4-L5` | DIRECTOR · typed | 118.86–122.49 | **page** | Show Kepler's third law on his page from 1619. |
| `C4-L7` | NARRATOR | 123.59–127.44 | **year** | Is there a rule linking a planet's distance to the length of its year? |
| `C4-L8` | NARRATOR | 127.75–137.13 | **longer** | His answer, in 1619: the year grows as distance to the power of one and a half. Four times farther, eight times longer. |
| `C4-L9` | NARRATOR | 137.43–142.88 | **sit** | On this kind of plot, his rule is a straight line. His six planets sit on it. |
| **C5** How it's made | | 9.2 s (144.6–153.8) | engraved | |
| `C5-L6` | NARRATOR | 144.58–149.24 | **nine** | One agent writes the plan, and nine more build the scenes at the same time. |
| `C5-L9` | NARRATOR | 149.54–153.83 | **captions** | Then each example is cut into a vertical Short, with captions. |
| **C6** Try it | | 4.9 s (156.2–161.2) | engraved | |
| `C6-L6` | NARRATOR | 156.23–161.17 | **GitHub** | Every animation here was made with vibe-animator, and it is free on GitHub. |

Secondary cues named in the visual notes (C0-L7 chips on `script`, `voices`, `animation`, `Shorts`; C2-L13 `Split`;
C3-L13 `yes`; C4-L8 `1619`; C5-L9 `cut`) are word lookups too.

## Continuity device: the 35 mm vertical film strip

Unchanged from v1 and already built: `engine/app/src/scenes/trailer_filmstrip_kit.ts` (`STRIP`, `drawStrip`,
`pullBack`, `pushIn`, `slideOn`, `outro('C<n>')`, `intro('C<n>')`). Every chapter's last line → `outro('C<n>')`;
the next chapter's first moments → `intro`. Exceptions in v2: **C0 → C1** is the card push (FLIP section), not the
strip; the strip slide-on of C2, C3 and C4 lands on that chapter's T3 frame `000`. C5 stops the strip on a light
table; C6 winds it onto a reel (`kit_c5c6.ts`).

## Honesty labels (binding)

- **C0:** kicker «REAL SESSION IN T3 CODE · CLAUDE HAIKU 5.5 · 25 S SHOWN IN ~7 S». Nothing claims that session made
  this video (it changed one label in another example).
- **C1–C4 and the C0 cards:** «prompt re-typed for this trailer» (above).
- **C1:** the attention map is labelled **ILLUSTRATIVE** (corner tag, ≥ 24 px).
- **C2:** the student is dramatized; al-Khwarizmi worked in words. The «centuries later» caption comes before any
  letter appears; the negative root is not attributed to him.
- **C3:** no «NP-complete» anywhere. The definition says «polynomial time» on both sides. Two AI cards, each stamped
  **not P vs NP**: «FunSearch: new cap-set constructions (2023)», «AlphaEvolve: improved algorithms (2025)».
- **C4:** fitted slope 1.498; «exactly» appears only as Kepler's word *praecise*. Mercury–Saturn only. The 1619 scan's
  rights are **unconfirmed**: typeset card (`paperBeat` `card`) and `// TODO paper page` until the orchestrator drops a
  confirmed page into `public/papers/`.
- **T3 Code** is credited on screen: its logo in the capture, the «T3 Code» tag in C0, and the end-card credit.

## C5 numbers (owner-supplied; on screen only, verbatim, nowhere else)

«about 1.1M tokens per finished minute» · «54 % fewer than the previous pipeline» · «chapters render in 1–3 minutes»
· «9 builder agents in parallel». The narration speaks none of them.

## The phone (C5)

A **generic** phone: a plain rounded slab with a dark screen. **No platform UI, no logos, no app chrome, no
like/share icons, no handles.** A thumb swipes through three Shorts made from *this* trailer's chapters.

## End card (C6)

- URL, written in on `GitHub` (C6-L6): **github.com/Fr4nzz/vibe-animator**
- Card text: **«Describe a video. Claude Code agents make it. Built with Claude Code + ElevenLabs. Prompts shown in
  T3 Code.»**
- Credits line (≥ 24 px): manim-web (MIT) · ElevenLabs · Claude Code · T3 Code (logo) · the Kepler scan source (once
  confirmed). No author email or any personal data.

## Shorts: one per chapter except C6, every line is in one

S01–S06 span C0–C5. **On every line of C0–C5, all text that matters sits inside x 420–1500** (qa `square`), the T3
text views included (by construction, see the lift-out). Captions own y > 928. S06 runs about 12 s.

## Music

Reused from the cached v1 take (no new generation): wonder 0–80.9 s, struggle 80.9–118.9 s (from C3-L7 «Explain»),
wonder 118.9–144.6 s (C4-L5 «Show»), hope 144.6 s on (C5-L6 «One»); insight accents on «Fill» (C2-L14, 68.06 s) and
«sit» (C4-L9, 141.94 s). Leave room for it; cue nothing to it.

## Builders (suggested)

Five builders, launched together once the T3 kit exists:
1. **C0 + `trailer_t3_kit.ts`** (kit first, then the scene): logo, session window, chips, cards, FLIP, push to C1.
2. **C1** (21 s; small changes, the first user of the T3 kit).
3. **C2** (33 s; full rebuild).
4. **C3** (36 s; rewrite and re-order).
5. **C4 + C5 + C6** (38 s together, all engraved; `kit_c5c6.ts` already shared).

## Known traps for this trailer

- `q.w('C1-L6', 'it')` must hit the quoted "it" (the first word starting with "it" in that line); check it on a strip.
- `'al-Khwarizmi'` and `'vibe-animator'` keep their hyphen as part of the token.
- `C3-L6` was respelled for the TTS («AI» → «Ay-eye», `voice.pronounce`); timings and captions keep «AI».
- C2-L14 and C4-L9 carry `mood_cue` (`fill`, `sit`) for the music accent; the scene cue is the same word.
- The T3 frames are 1920 × 1080: at z 2.2 they are upscaled and soft. That is fine for the push; the crisp prompt is
  the lifted scene text. Don't zoom further than about 2.4.
