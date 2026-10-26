# vibe-animator launch trailer: OUTLINE v2 (for owner approval)

**What changes.** The trailer now opens on the product: what vibe-animator is, what it makes, and one real agent session in T3 Code. Then the four examples, each starting from its prompt typed into T3 Code's composer, and each opening on its goal question before any diagram. It ends on a one-line call to action.
**Runtime.** About **2:50** if every line is voiced at tempo 1.1 (recommended, 1,956 characters). About 3:03 at tempo 1.0 with the three unchanged clips reused (1,699 characters). Estimates use the v1 voices' measured speaking rates, 0.3 s line gaps, 0.9 s chapter gaps and the script's holds. Script: `SCRIPT_v2.md` / `script_v2.json` (26 lines, 355 words).
**Hard rule.** No nutrition or health content. No channel names. No mention of the project the pipeline was built on.

## Beats (times at tempo 1.1)

| # | ~s | Voice | On screen | Transition out | Mood | Short |
|---|---|---|---|---|---|---|
| C0 What it is | 0–22 | NARRATOR | Epicycles trace the logo, "This is vibe-animator". The frame opens into the **full T3 Code window** playing the real Haiku session (48 s shown in ~7 s, kicker REAL SESSION), with chips SCRIPT, VOICES, ANIMATION, SHORTS popping in on their words. Then only the composer stays: **four composer cards** hold the four prompts, and each example's frame **FLIPs** from full screen into its slot on its phrase. | Camera pushes into card 1, which becomes the C1 composer | wonder | S01 "Describe a video. AI agents make it." |
| C1 Chatbot's next word | 22–48 | DIRECTOR, NARRATOR | Prompt typed in the T3 composer, lifts out as the title, UI dissolves. Sentence with a "?" slot, embedding cloud, attention line (ILLUSTRATIVE), probability bars fill the slot. | Film-strip pull-back, strip slides on to the next composer | wonder | S02 |
| C2 Completing the square | 48–84 | DIRECTOR, STUDENT, KHWARIZMI, NARRATOR | Goal first: square with a "?" side, = 39. Insight: area 64 means side 8. Moves, each with a reason, into a dashed target square. Fill, 64, side 8, minus 5 = 3. "Centuries later": the same pieces get letters and assemble the formula. | Film strip | wonder, *insight* on "Fill" | S03 |
| C3 P versus NP | 84–122 | DIRECTOR, NARRATOR | Sudoku checked in 1 s vs an empty grid with "?" on the stopwatch. Search tree branches per empty square, 2ⁿ outruns n² and n³. Gentle curves labelled polynomial time, definition. $1M card. FunSearch / AlphaEvolve cards stamped "not P vs NP". | Film strip | struggle | S04 |
| C4 Kepler's page | 122–148 | DIRECTOR, NARRATOR | Goal first: orbits, a ruler on the distance, a clock on the year. The 1619 page with highlight and translation. Gloss: 4× farther, 8× longer. Log-log plot, six planets snap to slope 1.5, *praecise* stamped as Kepler's word. | Film strip | wonder, *insight* on "sit" | S05 |
| C5 How it's made | 148–161 | NARRATOR | Plan node fans out to 9 agents, owner's generic numbers on screen. Cutting room: splicer cuts the P vs NP frame, vertical crop, captions, generic phone swipes 3 Shorts. | Strip winds onto a reel | hope | S06 "How 10 AI agents make one video" |
| C6 Try it | 161–170 | NARRATOR | Logo returns, github.com/Fr4nzz/vibe-animator, end card with credits incl. T3 Code logo. | End | hope | none |

## Owner points

1. **Start with the product.** C0 says what vibe-animator is and what it makes before any example ("You describe a video, and Claude Code agents make it: the script, the voices, the animation and the Shorts"). The logo trace moves from the end to the first second. The end is one line and the URL.
2. **T3 Code for the prompts.** C0 shows the full T3 window once, playing the real session. Every example then starts in T3's composer only: the prompt types with the DIRECTOR voice, the camera pushes in until the composer fills the frame, the typed line lifts out and settles as the scene title, and the UI dissolves into the plate. T3 Code is credited on screen (logo top-left in the capture, credit tag, end-card credit).
3. **"One sentence. That is the whole brief."** Removed. C0-L7 says plainly what the user does and what the agents do.
4. **Listing the four examples.** C0-L10: "You are about to see four examples Claude animated: a chatbot's next word, completing the square, P versus NP, and Kepler's third law."
5. **Preview thumbnails.** Each preview is a real full-screen frame of its example. On its phrase it holds about 0.4 s, then shrinks and flies into its slot beside its prompt card (FLIP, 0.6 s ease-out, no fade), one after another.
6. **Realistic prompts.** «Explain how a chatbot picks its next word.» «Show how al-Khwarizmi completed the square.» «Explain P versus NP with a sudoku.» «Show Kepler's third law on his page from 1619.» The v1 prompts «Make me a trailer.», «Now show them how it's made.» and «End on the repo.» are cut.
7. **Easy on first listen.** Every line was rewritten as short, concrete sentences. Jargon is defined where it first appears ("polynomial time" = time that grows gently, like n squared, and "to the power of one and a half" = four times farther, eight times longer). Figurative lines ("Make it hurt", "the cutting room makes its cut", "reaches for", "bets", "deterministic GPU render") are gone.

## Goal-first audit (every example now opens on its question)

| Chapter | Goal question (stated before visuals) | Steps, each with its reason | Payoff to repeat to a friend | Verdict |
|---|---|---|---|---|
| C1 | "How does a chatbot pick its next word?" (the prompt, plus a "?" slot after the sentence) | Words become points so similar meanings sit close (embedding cloud). To know what "it" means, the model looks back (attention line). | It weighs every possible next word by probability and picks one (bars fill the "?" slot). | **Rewrite** lines L6, L7 and the prompt. Animation: small changes |
| C2 | "A square plus ten of its sides makes 39. What is the side?" | Squares are easy to undo (64 → 8), so aim for one perfect square (dashed target). The 10 strip does not fit, so split it. Five on two sides almost fills the target. The missing corner is 5 × 5. | Fill it: 64, side 8, minus 5 = 3. Centuries later, the same moves with letters give the quadratic formula. | **Rebuild animation** |
| C3 | "Checking a sudoku takes a second. Is finding the answer always that fast?" | Finding can mean trying combinations, which multiply with every empty square (tree, 2ⁿ race). Fast means gentle growth like n² (named polynomial time). | If P = NP, finding is fast too. Nobody knows. $1M for a proof either way. AI might help, and has found new math elsewhere (not P vs NP). | **Rewrite** and re-order. Animation: new goal and reason beats |
| C4 | "Is there a rule linking a planet's distance to the length of its year?" | The page gives his answer (power of 1.5, glossed as 4× farther = 8× longer). On a log-log plot such a rule is a straight line, so we plot. | The six planets he knew sit on one line, slope 1.5. Kepler's word: *praecise*. | **Rewrite**. Animation: new goal beat and gloss, wedge cut |
| C0, C5 | What is it, and how is it made? | C0: describe → agents make script, voices, animation, Shorts (real T3 session as proof). C5: one plan agent, nine builders at once, then the Shorts cut. | You describe a video, and agents make it. | C0 **new**. C5 **trimmed** (render-timeline beat cut) |

**C2 animation beats that change (scene rebuild):** (1) opening: square with "?" side + 10-by-? strip + "= 39", no splitting yet. (2) new 64 → 8 demo square that stays small in a corner. (3) new dashed outline of the target square, kept through the whole move sequence. (4) the 10 strip bumps the outline before it splits ("does not fit"). (5) the corner fill now locks into the outline, and the demo flashes 64 → 8. (6) the side splits 5 + 3 and the 3 lands on the original "?". (7) formula beat: letters replace the same pieces in place (10 → b, half → b/2, corner → (b/2)², 39 → c), assembling x = √((b/2)² + c) − b/2 before the textbook formula. Kept: the watercolor courtyard, the half-strip swing, the amber 5 × 5 corner, the insight sting, the "centuries later" caption first.
**Other chapters' changed beats.** C1: "?" slot after the sentence, bars fill that slot. C3: stopwatch 1 s vs "?", tree branching per empty square before the curve race, amber "polynomial time" label on n²/n³, goal question returns over the definition. C4: orbits + ruler + clock goal beat, 4× / 8× two-orbit gloss, log-log ticks visible, *praecise* stamp, equal-areas wedge removed. C5: render-timeline beat removed.

## What changes in production

- **Reused as is:** film-strip kit (pull-back, slide-on), C1 embedding cloud and attention plate, C3 sudoku grid, curve race, $1M card and AI cards, C4 page highlight and translation panel and log-log plot, C5 fan-out with numbers, cutting room and phone, C6 reel and URL. Epicycle logo moves from C6 to C0.
- **Changed:** C1, C3, C4 (beats listed above), C5 (trimmed), C6 (one line, no second logo trace). **Rebuilt:** C2. **New:** C0, and a shared T3 transition kit (composer push-in, typed line lifts into the title, UI dissolve).
- **New T3 captures** (isolated instance, `/var/tmp/t3-trailer/start.sh`, no model run, never press Enter): for each of the 4 prompts, one screenshot per typed character, so the scene picks the frame by `q.typed` prefix length and stays deterministic. Plus one still with all four prompts typed for the C0 cards. The C0 window uses the existing 48 s webm, exported as a frame sequence. T3 logo from the capture.
- **Re-voice:** recommended all 26 lines at tempo 1.1 (1,956 characters). Alternative: 23 new lines at tempo 1.0 (1,699 characters), reusing C1-L2, C2-L7 and C3-L6, which runs about 3:03.
- **Music:** regenerate the score. The `section_styles` keys in `episode.json` (C2-L1, C2-L5, C2-L6, C3-L3, C4-L1, C4-L4, C6-L2) point to removed lines. New stings: C2-L14 "Fill", C4-L9 "sit". New section starts: C0-L6, C2-L8, C3-L7, C4-L5, C5-L6.

## Risks and open questions

1. **T3 trademark.** T3's terms forbid using its marks or trade dress without written permission. The MIT licence covers only the code. Ask T3 Tools Inc. before publishing.
2. **Prompts are re-typed.** The four prompts are typed for the trailer, with no model run behind them. Add a small "prompt re-typed for this trailer" tag? Owner to decide.
3. **Caption band.** T3's composer sits at y 916–1060 in the capture, inside the caption band (y > 928). The push-in must lift it above y 928 before any caption appears.
4. **C1 terms.** The prompt says "chatbot" and C1-L2 says "language model". If that reads as two things, re-voice C1-L2 as "A chatbot's language model turns each word into a point in space…".
5. **S06** runs about 12 s. Lengthen the phone hold if Shorts must be 15 s or more.
