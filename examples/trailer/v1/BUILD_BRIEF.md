# trailer build brief (scene builders): «vibe-animator: launch trailer»

Dev server **http://localhost:5730** (started by the orchestrator; never start your own). Narration is voiced
(`eleven_v4`, four voices); total **188.4 s**. Timings below come from `timing.json`; cue by word, never by second.

Read, in this order, and nothing else broadly:
1. `docs/AGENT_WORKFLOW.md`, Part 1 (binding: the loop, qa, finish without rendering).
2. `docs/STYLE_GUIDE.md` (binding, except where a look below replaces the engraved preset for your chapter).
3. This file.
4. Your pack: `packs/C<N>.md` (lines with timing, speaker, cue word, typed text, visual notes, kit pointers).
5. `engine/app/KIT_INDEX.md` for any other helper; `tools/nx kit examples/trailer show <name>` prints one export.

`OUTLINE.md` (fact table, risks) and `MUSIC_PLAN.md` are background; the music is not built yet, so leave room for it
but cue nothing to it.

## Hard rule (binding, every frame)

**No nutrition, health or medical content. No channel names. No mention of the project this pipeline was built
on.** No footage, thumbnail, caption text or plate from any other video: every flash frame, cutting-room frame and
phone Short is made from *this* trailer's own chapters. The only numbers on screen are the ones in this brief.

## The three looks

| Look | Chapters | What it is |
|---|---|---|
| **Engraved plate** (house style) | C0, C4, C5, C6 | `docs/STYLE_GUIDE.md` as written: hairline cross-hatched linework, bone paper plates (`paper: 1`), `signal` amber as the one glow, `blood` for signal on paper. |
| **Dark math** (a 3b1b-*like* look) | C1, C3 | Ink plates (`paper: 0`), glowing vector strokes on the signal layer, formulas and axes through the **manim-web layer** (`scenes/_manim.ts`, `ManimLayer`, `MathTex`, `Axes`; pattern in `examples/lens/scenes/c1.ts`). Cool secondary strokes in `bone`/`ash`; one amber protagonist per plate. |
| **Watercolor wash + clean ink geometry** | C2 | A soft watercolour wash for the Baghdad courtyard and the two figures (built from public-domain reference art via `refArt` / `refart find → clean → trace`, washed; no cartoon faces, no clip-art); the completing-the-square geometry inks on top in crisp hairlines, the 5×5 corner in amber. |

**Originality (binding):** no 3Blue1Brown code, assets, fonts, colour files or scene layouts. The look is an idiom;
every line of code is ours. manim-web (MIT) is a port of the Manim Community API and is credited in the end card.

## Continuity device: the 35 mm vertical film strip

At the end of every chapter the camera pulls back: the frame turns out to be one frame of a **vertical 35 mm film
strip** (sprocket holes both sides, edge frame numbers, a thin frame line), and the strip slides on (upwards) to the
next chapter's first frame. It is the same object in every chapter, so it lives in **one shared kit**:
`engine/app/src/scenes/trailer_filmstrip_kit.ts`.

- **Owner: the C0 builder.** Write the kit (API below, exactly these names) *first*, before your C0 scene, so the
  other builders can import it. Everyone else imports it read-only; need a change? Report it, don't edit it.
- **Exported API** (pure functions of `t`; draw with the `SC` you get in a shot's `draw`/`hud`):
  - `STRIP` — geometry constants: frame width/height in world px, sprocket pitch, gauge colour on ink and on paper.
  - `drawStrip(o: SC, opt: { cx: number; cy: number; frames: number; first: number; scroll: number; inner?: (o: SC, k: number, x: number, y: number, w: number, h: number) => void })`
    — a vertical strip centred at `cx, cy`, `frames` tall, edge numbers from `first`, offset by `scroll` (in frames);
    `inner` paints frame `k`'s picture (pass a thumbnail of your own plate, or leave the frame dark).
  - `pullBack(t: number, t0: number, t1: number): CamKey[]` — camera keys from the chapter's working view to the
    strip view (z from 1 to about 0.28), eased; append them to your last shot's `cam`.
  - `slideOn(t: number, t0: number, t1: number): number` — the strip's scroll (frames) for the hand-off, 0 → 1.
  - `outro(chapterEnd: number)` / `intro(chapterStart: number)` — the standard windows: pull-back starts 1.6 s
    before the chapter's last word ends plus its hold; slide-on fills the chapter gap. Use these so every hand-off
    has the same rhythm.
- **Each chapter:** last line → `outro`; first ~0.6 s of the next chapter → `intro` (the strip settles and the camera
  pushes back into the new frame). C5 stops the strip on a light table (cutting room); C6 winds it onto a reel. Both
  build those on `drawStrip` in their own private kit.

## Honesty labels (binding)

- **C1:** the attention map is labelled **ILLUSTRATIVE** (small corner tag, ≥ 24 px). It is not a measured map.
- **C3:** no "NP-complete" caption anywhere; the sudoku is only a picture of checking vs finding, and the explosion is
  framed "as the puzzle grows". On-screen definition says "polynomial time" on both sides.
- **C3-L6:** two cards, each stamped **not P vs NP**: "FunSearch: new cap-set constructions (2023)" and
  "AlphaEvolve: improved algorithms (2025)". The "might" stays a might: nothing on screen implies AI has touched P vs NP.
- **C2:** al-Khwarizmi worked in words; the student is dramatized. A "centuries later" caption comes before the
  morph into symbols (C2-L7).
- **C4:** the fitted slope is 1.498; "exactly" is Kepler's word, shown as his. Plot only Mercury–Saturn (data in
  `OUTLINE.md`, fact table). The 1619 page: the archive.org scan's rights are **unconfirmed**; until the orchestrator
  drops a confirmed public-domain page into `public/papers/`, use a typeset card of the Latin sentence
  (`paperBeat` `card` or `typeCard`) and leave `// TODO paper page`.

## C5 numbers (owner-supplied; on screen only, verbatim, nowhere else)

"about 1.1M tokens per finished minute" · "54 % fewer than the previous pipeline" · "chapters render in 1–3 minutes"
· "9 builder agents in parallel". The narration speaks none of them.

## The phone (C5)

A **generic** phone: a plain rounded slab with a dark screen. **No platform UI, no logos, no app chrome, no
like/share icons, no handles.** A thumb swipes through three Shorts made from *this* trailer's chapters.

## End card (C6)

- URL, written in on `repo` (C6-L2): **github.com/Fr4nzz/vibe-animator**
- Card text: **«Every frame you just saw was made with this repo. Built with Claude Code + ElevenLabs.»**
- Credits line (≥ 24 px): manim-web (MIT) · ElevenLabs · Claude Code · the Kepler scan source (once confirmed).
- No author email or any personal data.

## The director's typed prompts

Every DIRECTOR line is marked `typed` in `script.json`: the prompt is typed on screen *in step with the voice*.
Draw `this.q.typed('C0-L1', t)` (the prefix typed by `t`; each word's letters appear while it is spoken) with a
blinking caret (`Math.floor(t * 2) % 2`, deterministic). `this.q.speaker(id)` / `this.q.speakerAt(t)` give the role
if you want a speaker tag (KHWARIZMI / STUDENT in C2). The prompt sits in a quiet console line, mono, ≥ 30 px.

## Shorts: one per chapter, and every line is in one

S01–S07 each span a whole chapter (hook titles in `script.json`). **So every line of the trailer is a Short line:
all text that matters sits inside x 420–1500, always** (qa `square`). The film-strip pull-back is centred too. Captions
own y > 928.

## Cue words, per line (from SCRIPT.md, with voiced timings)

The bold word is where the line's key animation lands: `this.q.w(lineId, word)`.

| line | speaker | time (s) | cue | text |
|---|---|---|---|---|
| **C0** One prompt | | 22.4 s (0.5–22.9) | engraved | |
| `C0-L1` | DIRECTOR · typed | 0.50–1.86 | **trailer** | Make me a trailer. |
| `C0-L2` | NARRATOR | 3.16–6.36 | **sentence** | One sentence. That is the whole brief. |
| `C0-L3` | NARRATOR | 6.66–12.58 | **agents** | Script, voices, scenes and cuts: Claude Code agents make them all. |
| `C0-L4` | NARRATOR | 12.88–21.28 | **1619** | A language model. A ninth-century master. A million-dollar problem. A page from 1619. |
| `C0-L5` | NARRATOR | 21.58–22.94 | **build** | Watch it build. |
| **C1** Attention | | 23.3 s (25.8–49.1) | dark math | |
| `C1-L1` | DIRECTOR · typed | 25.84–28.88 | **attention** | Explain attention. Twenty seconds. |
| `C1-L2` | NARRATOR | 30.18–36.74 | **space** | A language model turns each word into a point in space, where related meanings sit close together. |
| `C1-L3` | NARRATOR | 37.04–44.16 | **it** | Each word looks back and weighs the words before. Here, "it" reaches for "the cat". |
| `C1-L4` | NARRATOR | 44.46–49.10 | **bets** | Then it gives every word it knows a probability, and bets on one. |
| **C2** Completing the square | | 33.7 s (50.8–84.5) | watercolor + ink | |
| `C2-L1` | DIRECTOR · typed | 50.80–54.72 | **square** | Baghdad, ninth century. Complete the square. |
| `C2-L2` | STUDENT | 55.02–59.50 | **ten** | A square and ten roots make thirty-nine. I am stuck. |
| `C2-L3` | KHWARIZMI | 59.80–63.48 | **half** | Split the ten in half. Five on two sides. |
| `C2-L4` | KHWARIZMI | 63.78–67.30 | **corner** | Now a corner is missing: five by five. |
| `C2-L5` | KHWARIZMI | 67.60–72.88 | **fill** | Fill it, and the square is whole: eight by eight. The root is three. |
| `C2-L6` | NARRATOR | 73.18–78.38 | **al-jabr** | That was al-Khwarizmi, and his al-jabr gave algebra its name. |
| `C2-L7` | NARRATOR | 78.68–84.52 | **formula** | He wrote it all in words. Centuries later, the picture became a formula. |
| **C3** P versus NP | | 33.1 s (86.2–119.3) | dark math | |
| `C3-L1` | DIRECTOR · typed | 86.22–89.98 | **hurt** | P versus NP. Make it hurt. |
| `C3-L2` | NARRATOR | 90.28–95.08 | **second** | Checking a finished puzzle takes a second. Finding the answer may not. |
| `C3-L3` | NARRATOR | 95.38–99.38 | **explodes** | As the puzzle grows, the search explodes. |
| `C3-L4` | NARRATOR | 99.68–107.92 | **solvable** | P equals NP would mean anything checkable in polynomial time is also solvable in polynomial time. |
| `C3-L5` | NARRATOR | 108.22–112.70 | **million** | Nobody knows. A proof is worth a million dollars. |
| `C3-L6` | NARRATOR | 113.00–119.32 | **mathematics** | AI might help find that proof. On other problems, it has already found new mathematics. |
| **C4** Kepler's page | | 22.7 s (121.0–143.8) | engraved | |
| `C4-L1` | DIRECTOR · typed | 121.02–123.98 | **page** | Kepler. Show me the actual page. |
| `C4-L2` | NARRATOR | 124.28–130.68 | **sentence** | In 1619, Kepler wrote a sentence he called most certain and most exact. |
| `C4-L3` | NARRATOR | 130.98–136.18 | **power** | A planet's period grows with its distance to the power of one and a half. |
| `C4-L4` | NARRATOR | 136.48–143.76 | **exactly** | Plot the six planets he knew, and they fall on one straight line. His word for it: exactly. |
| **C5** How it's made | | 21.8 s (145.5–167.3) | engraved | |
| `C5-L1` | DIRECTOR · typed | 145.46–147.46 | **made** | Now show them how it's made. |
| `C5-L2` | NARRATOR | 147.76–153.84 | **Nine** | One orchestrator writes the plan. Nine builder agents make the scenes at the same time. |
| `C5-L3` | NARRATOR | 154.14–160.06 | **word** | A deterministic GPU render stitches them together, cued to every word. |
| `C5-L4` | NARRATOR | 160.36–163.00 | **cut** | Then the cutting room makes its cut. |
| `C5-L5` | NARRATOR | 163.30–167.30 | **captioned** | Each chapter stands up as a Short, framed and captioned. |
| **C6** The repo | | 15.1 s (169.7–184.8) | engraved | |
| `C6-L1` | DIRECTOR · typed | 169.70–171.30 | **repo** | End on the repo. |
| `C6-L2` | NARRATOR | 174.10–177.22 | **repo** | Every frame you just saw was made with this repo. |
| `C6-L3` | NARRATOR | 177.52–184.80 | **build** | Describe the explainer you want. The agents build the rest: script, voices, scenes and Shorts. |

## Builders (suggested)

Six builders: C0 (owns `trailer_filmstrip_kit.ts`), C1, C2, C3, C4, and C5 + C6 together (C6 is 15 s; the strip runs
straight from the light table onto the reel). C2 and C3 are the longest (~33 s each).

## Known traps for this trailer

- `q.w('C1-L3', 'it')` hits the quoted "it" (the first word starting with "it" in that line); check it on the strip.
- `q.w('C2-L6', 'al-jabr')`: the hyphen is part of the token; `'al-Khwarizmi'` likewise.
- The C3-L6 audio was respelled for the TTS ("AI" → "Ay-eye", `voice.pronounce`); the timings and captions keep "AI".
