# vibe-animator: launch trailer (v2): script for review

26 lines · 357 words · ~2.4 min. Generated from script.json by tools/check_script.py; edit script.json, not this file. In brackets: references. ▶ = start/end of a Short.


## C0 · What vibe-animator does

L6. **NARRATOR** · This is vibe-animator. ▶ S01 (start): «Describe a video. AI agents make it.»
   _Visual: Engraved plate, warm paper. Fourier epicycles (moved here from the v1 end card) trace the logo. On 'vibe-animator' the wordmark writes in under it._

L7. **NARRATOR** · You describe a video, and Claude Code agents make it: the script, the voices, the animation and the Shorts.
   _Visual: The logo's frame opens into the full T3 Code window: the real session (/var/tmp/t3-trailer/capture, 48 s retimed to ~7 s) shows a typed request, 'Working for Ns', progress lines ('Running grep', 'Running nx') and the final 'Worked for 25s' answer with 'TOTAL 0'. Kicker (>= 24 px): REAL SESSION IN T3 CODE · CLAUDE HAIKU 5.5 · 25 S SHOWN IN ~7 S. T3 Code logo visible top-left. Credit tag 'T3 Code' bottom-left. On 'script', 'voices', 'animation' and 'Shorts' four engraved chips pop in along the right edge, one per word. The window stays inside x 420-1500 for the Short (scaled, slow pan from the prompt bubble to the answer)._

L10. **NARRATOR** · You are about to see four examples Claude animated: a chatbot's next word, completing the square, P versus NP, and Kepler's third law. ▶ S01 (end): «Describe a video. AI agents make it.»
   _Visual: The T3 window dissolves, keeping only its composer. Four composer cards stack in a column, each holding one example prompt (the four DIRECTOR prompts of C1-C4, already typed). An empty preview slot sits right of each card. FLIP previews, one per phrase, on its first word: a real full-screen frame of that example (C1 the attention line, C2 the filled 8x8 square, C3 the 2^n curve, C4 the 1619 page) holds ~0.4 s, then shrinks and flies into its slot (0.6 s ease-out, no fade). On 'law' the fourth lands, and the camera pushes into card 1, which becomes the C1 composer._


## C1 · A chatbot's next word

L8. **DIRECTOR** · Explain how a chatbot picks its next word. ▶ S02 (start): «How a chatbot picks its next word»
   _Visual: GOAL FIRST. T3 composer only (isolated capture, no model run). The prompt types with the voice. On Enter the camera pushes in, the typed line lifts out of the composer, scales up and settles as the scene title. The UI dissolves into the dark-math plate. The sentence 'The cat sat on the mat because it was tired' writes in as tokens, with an empty slot after 'tired' and a '?' in it._

L2. **NARRATOR** · A language model turns each word into a point in space, where related meanings sit close together.
   _Visual: Unchanged: on 'space' the tokens lift into a slowly rotating 3D embedding cloud, and 'cat' and 'mat' drift near each other. All code original._

L6. **NARRATOR** · To know what "it" means, the model looks back and pays most attention to "the cat".
   _Visual: Reason stated before the move: on the quoted 'it' faint lines run from 'it' to every earlier word, and the line to 'the cat' brightens. Corner tag: ILLUSTRATIVE._

L7. **NARRATOR** · Then the model weighs every possible next word by probability and picks one. ▶ S02 (end): «How a chatbot picks its next word»
   _Visual: Payoff: probability bars race in the '?' slot. On 'picks' one bar is sampled and drops into the sentence. Pull-back to the film strip._


## C2 · Completing the square

L8. **DIRECTOR** · Show how al-Khwarizmi completed the square. ▶ S03 (start): «The 1,200-year-old trick behind the quadratic formula»
   _Visual: T3 composer, typed with the voice. The prompt lifts out and becomes the title. The UI dissolves into the watercolor courtyard (master and student at a table)._

L9. **STUDENT** · A square plus ten of its sides makes thirty-nine. What is the side?
   _Visual: GOAL FIRST. Clean ink over the wash: a square whose side carries a big '?', a 10-by-? strip beside it, '= 39' under both. On 'side' the '?' pulses. The student is dramatized._

L12. **KHWARIZMI** · Make one perfect square. Then the side is easy: area sixty-four, side eight.
   _Visual: THE INSIGHT BEFORE ANY MOVE. A small demo square labelled 'area 64'. On 'eight' its side reads 8. The demo slides aside and stays small in a corner. A dashed outline of the perfect square we are aiming for appears around the messy shape._

L13. **KHWARIZMI** · The ten does not fit. Split it: five on two sides. A corner is missing, five by five.
   _Visual: Each move with its reason: the 10 strip bumps against the dashed outline ('does not fit'). On 'Split' it halves and the two 5-wide strips swing onto two sides. The shape almost fills the outline. On 'corner' the empty 5x5 gap glows amber and '25' writes inside._

L14. **KHWARIZMI** · Fill it, and the area is sixty-four. Side eight. Take away five: three.
   _Visual: On 'Fill' the corner fills and the square locks into the outline (insight sting). '39 + 25 = 64' writes on screen (not spoken). The corner demo flashes (64 -> 8, same as before). The side splits into 5 + 3 and the 3 lands on the '?'._

L7. **NARRATOR** · He wrote it all in words. Centuries later, the picture became a formula. ▶ S03 (end): «The 1,200-year-old trick behind the quadratic formula»
   _Visual: Reused audio. A 'centuries later' caption first. Then the same pieces get letters, in place: 10 -> b, each half -> b/2, the corner -> (b/2)^2, 39 -> c. They assemble into x = sqrt((b/2)^2 + c) - b/2, each term glowing from its piece of the picture. On 'formula' it settles into the textbook quadratic formula, labelled 'same recipe, general form'. Pull-back to the film strip._


## C3 · P versus NP

L7. **DIRECTOR** · Explain P versus NP with a sudoku. ▶ S04 (start): «Checking is easy. Is finding easy?»
   _Visual: T3 composer, typed with the voice. The prompt lifts out and becomes the title. The UI dissolves into the dark-math plate._

L11. **NARRATOR** · Checking a finished sudoku takes a second. Is finding the answer always that fast?
   _Visual: GOAL FIRST. A filled sudoku ticks green row by row within one second (a stopwatch reads 1 s). On 'fast' an empty grid appears beside it with a stopwatch reading '?'. No 'NP-complete' caption._

L12. **NARRATOR** · Finding it can mean trying combinations, and they multiply with every empty square.
   _Visual: The reason for the blow-up, shown: the empty grid grows larger. A search tree branches from it, one level per empty square. On 'multiply' the plot race starts: n^2, n^3 and 2^n, and 2^n goes vertical while the tree fills the frame._

L13. **NARRATOR** · Fast means time that grows gently, like n squared: polynomial time. If P equals NP, then yes, finding is fast too.
   _Visual: The gentle curves (n^2, n^3) light amber and the 2^n curve dims. On 'polynomial' the label 'polynomial time' writes on the amber curves. The goal question from C3-L11 returns as text. On 'yes' the LaTeX definition writes under it: 'P = NP: every problem checkable in polynomial time is solvable in polynomial time'._

L10. **NARRATOR** · Nobody knows. A proof either way wins a million dollars.
   _Visual: On 'million' the card '$1,000,000 Millennium Prize'._

L6. **NARRATOR** · AI might help find that proof. On other problems, it has already found new mathematics. ▶ S04 (end): «Checking is easy. Is finding easy?»
   _Visual: Unchanged: two cards on 'mathematics', 'FunSearch: new cap-set constructions (2023)' and 'AlphaEvolve: improved algorithms (2025)', each stamped 'not P vs NP'. Pull-back to the film strip._


## C4 · Kepler's page

L5. **DIRECTOR** · Show Kepler's third law on his page from 1619.  `[Harmonices Mundi (Linz, 1619), Book V ch. III, p. 189]` ▶ S05 (start): «Kepler's sentence that ran the solar system»
   _Visual: T3 composer, typed with the voice. The prompt lifts out and becomes the title. The UI dissolves into the engraved plate._

L7. **NARRATOR** · Is there a rule linking a planet's distance to the length of its year?
   _Visual: GOAL FIRST. Six planets on orbits around the Sun. A ruler marks Mars's distance, and a clock ticks its year. On 'year' the clock stops on a '?'._

L8. **NARRATOR** · His answer, in 1619: the year grows as distance to the power of one and a half. Four times farther, eight times longer.  `[Harmonices Mundi p. 189]`
   _Visual: On '1619' the page (or the typeset card until the scan's rights are confirmed) slides in. An amber highlight sweeps 'Sed res est certissima exactissimaque ...'. The translation panel reads 'the ratio of the periods is precisely the 3/2 power of the ratio of the mean distances'. The gloss on 'longer': two orbits, one 4x the other's radius, with clocks reading 1 and 8._

L9. **NARRATOR** · On this kind of plot, his rule is a straight line. His six planets sit on it.  `[NASA NSSDCA Planetary Fact Sheet]` ▶ S05 (end): «Kepler's sentence that ran the solar system»
   _Visual: Log-log axes, period vs distance (axis ticks 1, 10, 100 shown so 'this kind of plot' is visible). Mercury to Saturn drop dots. On 'sit' they snap to a line of slope 1.5 (insight sting), and Kepler's own word from the page, 'praecise' (exactly), stamps beside the line. The fitted slope is 1.498, so the narration does not say 'exactly' itself. Pull-back to the film strip._


## C5 · How it's made

L6. **NARRATOR** · One agent writes the plan, and nine more build the scenes at the same time. ▶ S06 (start): «How 10 AI agents make one video»
   _Visual: Engraved plate. A plan node appears, then on 'nine' it fans out to 9 agent nodes. Generic owner numbers tick in on screen only: ~1.1M tokens per finished minute, 54 % fewer than the previous pipeline, chapters render in 1-3 minutes, 9 builder agents in parallel._

L9. **NARRATOR** · Then each example is cut into a vertical Short, with captions. ▶ S06 (end): «How 10 AI agents make one video»
   _Visual: Cutting room: the strip stops on a light table. On 'cut' a splicer cuts this trailer's own P vs NP frame. The frame stands vertical, a crop square locks on, captions write in on 'captions'. It drops into a generic phone (no platform UI or logos) and a thumb swipes through 3 Shorts from this trailer. Pull-back to the film strip._


## C6 · Try it

L6. **NARRATOR** · Every animation here was made with vibe-animator, and it is free on GitHub.
   _Visual: The strip winds onto a reel. The logo from C0 returns (no second epicycle trace), and on 'GitHub' github.com/Fr4nzz/vibe-animator writes in under it. End card: 'Describe a video. Claude Code agents make it. Built with Claude Code + ElevenLabs. Prompts shown in T3 Code.' Credits (>= 24 px): manim-web (MIT) · ElevenLabs · Claude Code · T3 Code (logo) · the Kepler scan source._


## Shorts

| Short | Lines | Words | Approx. | hook_title |
|---|---|---|---|---|
| S01 | C0-L6 → C0-L10 | 45 | ~16 s | Describe a video. AI agents make it. |
| S02 | C1-L8 → C1-L7 | 54 | ~20 s | How a chatbot picks its next word |
| S03 | C2-L8 → C2-L7 | 76 | ~28 s | The 1,200-year-old trick behind the quadratic formula |
| S04 | C3-L7 → C3-L6 | 80 | ~29 s | Checking is easy. Is finding easy? |
| S05 | C4-L5 → C4-L9 | 63 | ~23 s | Kepler's sentence that ran the solar system |
| S06 | C5-L6 → C5-L9 | 26 | ~9 s | How 10 AI agents make one video |
