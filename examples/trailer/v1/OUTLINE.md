# vibe-animator — Launch Trailer OUTLINE (v1, for owner approval)

**Thesis.** You describe the explainer you want, and Claude Code agents build it: script, voice, scenes, render, Shorts. Every frame of this trailer was made that way.
**Audience.** Developers, creators, and math and ML fans on GitHub and YouTube.
**Length.** About 2:30, English first. Lines stay short and idiom-free so the Spanish version can be translated line by line.
**Continuity.** At the end of each segment the camera pulls back. The frame turns out to sit on a vertical 35 mm film strip (sprocket holes, frame numbers), and the strip slides on to the next segment.
**Hard rule.** No nutrition or health content. No channel names. No mention of the project the pipeline was built on. Numbers appear only in the owner's generic form.

## Segments

| # | ~s | Voice(s) | Mood | Director's prompt (typed + read aloud) | Narration gist (not final lines) | Key animation, and the word it lands on | Short |
|---|---|---|---|---|---|---|---|
| 0 | 10 | DIRECTOR, NARRATOR | wonder | «Make me a trailer.» | One sentence is all it takes. Watch it build. | A cursor blinks and the prompt types itself. On **"build"**, the letters break into particles that rush into the first frame. | Teaser: "one prompt → this video" |
| 1 | 25 | DIRECTOR, NARRATOR | wonder | «Explain attention. Twenty seconds.» | A model sees words as points in space and decides which earlier words matter. Then it bets on the next word. | Tokens lift into a rotating 3D embedding cloud. On **"it"**, an attention line from "it" to "the cat" brightens. Probability bars race, and on **"bets"** one bar is sampled and drops into the sentence. All code original; nothing copied from 3b1b. | "How an LLM picks its next word" |
| 2 | 25 | DIRECTOR, AL-KHWARIZMI, STUDENT, NARRATOR | wonder → **insight** accent | «Baghdad, 9th century. Complete the square.» | The student is stuck on a square plus ten roots equal to thirty-nine. The master splits the ten in half, sees a missing corner, and fills it in. Centuries later, the same picture becomes a formula. | x² square + 10x rectangle. On **"half"**, the rectangle splits and two 5-wide strips attach. On **"corner"**, the 5×5 gap glows. On **"fill"**, the perfect 8×8 square locks (insight sting). It morphs into symbols, and the quadratic formula assembles. | "The 1,200-year-old trick behind the quadratic formula" |
| 3 | 25 | DIRECTOR, NARRATOR | **struggle** | «P versus NP. Make it hurt.» | Checking a solution can be fast while finding one may not be. P = NP would mean every quickly checkable problem can also be *solved* in polynomial time. Nobody knows, and there's a million dollars on it. AI might one day help find the proof, and it has already found new mathematics elsewhere. | A grid gets ticked green in a second while a search tree explodes beside it. A plot race: n², n³ and 2ⁿ, and on **"explodes"** 2ⁿ goes vertical. On **"million"**, a "$1,000,000 Millennium Prize" card appears. Two small cards follow: FunSearch (cap sets, 2023) and AlphaEvolve (algorithms, 2025), labeled "not P vs NP". | "Checking is easy. Is finding easy?" |
| 4 | 22 | DIRECTOR, NARRATOR | wonder → **insight** | «Kepler. Show me the actual page.» | In 1619 Kepler wrote that the ratio between planets' periods is *exactly* one and a half times the ratio of their distances. Plot it, and six planets fall on one line. | A real 1619 page appears. The key sentence gets an amber highlight, then a translation panel slides in. The equal-areas wedge sweeps (2nd law, 1609). Planets drop dots onto a log-log plot of period vs distance, and on **"exactly"** they snap to a straight line of slope 1.5. | "Kepler's sentence that ran the solar system" |
| 5 | 28 | DIRECTOR, NARRATOR | **hope** | «Now show them how it's made.» | One orchestrator writes the plan, nine builder agents make scenes in parallel, and a deterministic GPU render stitches them, cued to every word. Then the cutting room turns each chapter into Shorts with captions. | The orchestrator node fans out to 9 agents, with the generic numbers ticking in. **Cutting room (~12 s):** the strip stops on a light table, and a splicer cuts the P vs NP frame on **"cut"**. The frame stands vertical, a crop square locks on, and captions write in. It drops into a *generic* phone (no platform UI or logos), where a thumb swipes through 3 Shorts. | "How 9 AI agents edit a documentary" |
| 6 | 15 | NARRATOR | **hope** | «End on the repo.» | Every frame you just saw was made with this repo. | The strip winds onto a reel, and the reel's spokes become Fourier epicycles that trace the logo. Then `github.com/Fr4nzz/vibe-animator` appears, with «Every frame you just saw was made with this repo. Built with Claude Code + ElevenLabs.» | Logo sting / end card |

**On-screen numbers (generic, owner-supplied, used as given):** "a 14-minute documentary episode: about 1.1M tokens per finished minute, 54 % fewer than the previous pipeline; chapters render in 1–3 minutes; 9 builder agents in parallel."

## Visual style per segment

- **House style: engraved plate.** Segments 0, 4, 5 and 6 use cross-hatched linework on warm paper, with amber as the accent.
- **Math (segments 1 and 3):** 3b1b-like dark background, glowing vector strokes, LaTeX. The look is ours; the code is original.
- **Story (segment 2):** watercolor wash for Baghdad and the two characters. The geometry inks on top of it in clean lines.
- **Selling point:** one repo, three distinct visual languages, joined by the film strip. The range is itself the pitch.

## Fact checks

| Claim | Source | Status |
|---|---|---|
| FunSearch found new large cap-set constructions (plus bin-packing heuristics) | Romera-Paredes et al., *Nature* 625:468–475, DOI 10.1038/s41586-023-06924-6 (online 14 Dec 2023), checked via paper-search | **verified** |
| AlphaEvolve improved known algorithms (4×4 complex matrix multiplication in 48 scalar multiplications; better solutions on ~20 % of 50+ open problems) | DeepMind blog, 14 May 2025; arXiv DOI 10.48550/arXiv.2506.13131, checked via paper-search | **verified**. The blog never mentions P vs NP, so neither do we. |
| Clay Millennium Prize: $1M per problem; announced in Paris, 24 May 2000 | claymath.org/millennium-problems | **verified** |
| P vs NP stated as "if it's easy to check a solution, is it also easy to solve?" | claymath.org/millennium/p-vs-np | **verified**. The on-screen definition uses "polynomial time", not "the same time as checking". |
| Al-Khwarizmi wrote *al-Kitāb al-mukhtaṣar fī ḥisāb al-jabr wa-l-muqābala* in Baghdad, dedicated to Caliph al-Ma'mun (House of Wisdom), early 9th c. (c. 820–830) | MacTutor biography; MAA source materials ("around 830") | **verified**. Sources disagree on the exact year, so the trailer says only "9th century". |
| The worked example x² + 10x = 39 → x = 3, with the "two quadrangles of 5 on two sides; the missing 5×5 corner" figure | Rosen's 1831 English translation (archive.org `algebra-mohammed-ben-musa`): "construct two quadrangles on two sides … a quadrate remains opposite the corner … five multiplied by five" | **verified**. His work was in words only. The symbolic quadratic formula came later, and the narration must say so ("centuries later"). |
| Kepler's 3rd-law sentence: «Sed res est certissima exactissimaque, quod proportio quae est inter binorum quorumcunque Planetarum tempora periodica, sit **praecise sesquialtera** proportionis mediarum distantiarum» | *Harmonices Mundi* (Linz, 1619), Book V ch. III, **p. 189** (runs onto p. 190). Scan: archive.org/details/ioanniskepplerih00kepl/page/n280 (Smithsonian Libraries). I viewed the page image myself. | **verified**. "praecise" / "exactissima" = the «exactly» cue word. The same passage dates the discovery to 8 March / 15 May 1618. |
| The 1619 page is public domain | Kepler died in 1630, so the text is PD everywhere | **verified** for the text. **Unverified** for the scan: the archive.org item has no rights field. Confirm Smithsonian's "no known restrictions", or use another PD scan. |
| Equal areas (2nd law) published in *Astronomia Nova*, 1609 | Standard history; not separately fetched | **unverified** (low risk) |
| Planet data for the log-log plot (a in AU, T in years): Mercury 0.387/0.241, Venus 0.723/0.615, Earth 1/1, Mars 1.524/1.881, Jupiter 5.204/11.86, Saturn 9.57/29.43; T²/a³ = 0.99–1.00; fitted slope **1.498** | NASA NSSDCA Planetary Fact Sheet (distance and period, converted) | **verified**. Plot only the six planets Kepler knew. |
| "Sudoku is NP-complete" (generalized n²×n², Yato & Seta 2003) | No DOI found | **unverified**. Show the sudoku only as a picture of "checking vs finding"; don't caption it NP-complete. |
| LLM attention "it → the cat" | Illustrative, not a measured attention map | Label it **illustrative** |
| Pipeline numbers (1.1M tokens/min, −54 %, 1–3 min chapters, 9 agents) | Owner-supplied internal measurement | **unverified by me**. Used verbatim in generic form. |

## Risks and open questions

1. **Honesty in segment 3.** The cards must read "found new constructions / improved algorithms". Neither system touched P vs NP. The line "AI might help *find a proof*" must stay a "might".
2. **A 9×9 sudoku is easy to solve by computer.** The exploding tree must be framed as "as the puzzle grows", or a critic gets an easy hit.
3. **Anachronism in segment 2.** The student is a dramatized character, and al-Khwarizmi had no symbols and no negative roots. The morph into algebra needs a "centuries later" beat. **Pronunciation:** check how ElevenLabs says "al-Khwarizmi" and "al-jabr", in both English and Spanish.
4. **Hard-rule leak.** The cutting-room and Shorts frames must not reuse any existing episode footage, thumbnail or caption text. The P vs NP fragment has to come from *this* trailer. The phone UI stays generic, and every frame needs a pre-publish audit.
5. **Music is "planned".** If ElevenLabs Music isn't ready, do we say "story-beat music" on screen, or only show it as a roadmap card? Owner to decide.
6. **Length.** The segments add up to ~150 s, so segments 3 and 5 are tight. Fallback: cut the equal-areas wedge (−4 s).
7. **The Spanish version** will run about 15 % longer. Do we keep the timings and shorten the lines, or let segments stretch?
8. **3b1b look-alike.** Using the visual idiom is fine, but no code or assets. Should the credits name manim-web's license?
