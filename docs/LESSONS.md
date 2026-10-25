# Lessons

Only mistakes an AI agent actually made while producing real episodes, where another agent (or the user) showed the
better way. Things a competent agent does right unprompted are not listed. Format: what went wrong → the rule →
where the rule now lives. Where a rule already existed and was broken anyway, the entry says so: those rules are now
enforced by a tool where possible, because wording alone failed.

## Art and visual quality

1. **Anatomy drawn in code instead of from a reference.** A builder needed a kidney cross-section that the art library
   lacked. It found the public-domain Gray's plate, hid the printed labels under rectangles that cut into the anatomy,
   gave up after one try and drew the organ procedurally ("after Gray"). It looked amateur next to traced art. In the
   same hour another builder traced a public-domain lithograph into line art and it looked right.
   → Anatomy is never drawn procedurally. Order: CC/PD vector → PD plate with labels **inpainted** (`refart clean`),
   then traced (`refart trace`) → ask the orchestrator for an asset agent. "Consulted a reference, then drew it" does
   not count. *STYLE_GUIDE §A, `refart`.*
2. **Art approved from a 390-px contact-sheet tile.** The sheet is for layout; a plate's craft is invisible at that
   size. → Every new plate gets one full-size still (`qa --still`) or crop (`qa --crop`) at the moment it is complete.
   About 2k tokens each. *WORKFLOW, `qa.ts`.*
3. **Self-reported weaknesses shipped.** Builders wrote "small text", "cut-off equation", "sinus reads as a stylised
   star" in their notes; the orchestrator passed them, and the user found each one later. → A reported weakness that
   breaks a style rule blocks the asset until it is fixed or the user waives it. *WORKFLOW (orchestrator).*
4. **Contact sheets sampled mid-animation.** Lines were sampled at 60 %, so complete safety cards looked unfinished and
   one builder forked the QA tool to see end states. → `qa --at end` and `qa --texts` (plain text of what is on screen
   at each line's end; grep the required phrases without reading an image). *`qa.ts`.*
5. **"Checked by eye, all pass" was not evidence.** Builders reported clean stills; the automated checker then found
   crop, hold and size failures, and only 3 of 8 Shorts had been looked at. → Before cutting Shorts, `qa --every 1` must
   report zero `square`, `hold` and `caption` findings on every line of every Short unit. *WORKFLOW.*

## Script and tone

6. **The orchestrator broke its own honesty rule.** "Concentrate honesty in one chapter" was in the project rules, yet
   the orchestrator's own edits and the fact-check merge added qualifiers to winning lines ("more modest than its
   reputation", evidence tags on plates). It cost re-voicing 68 lines and two re-renders. → The rule applies to the
   orchestrator's edits and to fact-check merges explicitly: a fact-check replaces a wrong number in place and sends any
   new limitation to the honesty chapter's list. *TONE.*
7. **Narration not frozen before rendering.** Translation panels added later ran 2–4 s into the next line. → Freeze
   `script.json` after the pronunciation, plain-language and tone passes and before any render; a paper moment exists
   only if its own line gives max(4 s, 0.33 s × words + 1.5 s). *WORKFLOW checklist.*
8. **A respelling table mispronounced an acronym**, and speech-to-text checks stopped after the auditions. → Re-run the
   speech-to-text check on every new take. *WORKFLOW.*

## Pipeline and machine

9. **A stale clip looked fresh.** A caption fix landed while a chapter was rendering; the clip baked in the old caption
   but had a newer file time, so "pending" detection missed it. The builder had seen the bug 40 minutes earlier but
   reported it only after queuing the render. → Pending is decided by input hashes recorded at render start; a builder
   that finds a bug in a file it does not own reports it before queuing anything. *`render_chapter.ts`, WORKFLOW.*
10. **Stale Shorts published.** Publishing checked only that files existed. → Masters and Shorts carry receipts with
    input hashes; run `verify-fresh` before publishing anything. *Receipts.*
11. **Renders ran on the CPU for two days** (Chromium's software fallback, 8.7× slower). A one-off GPU probe in a
    different browser launch was trusted. → Every browser launch logs its WebGL renderer and aborts on a software
    renderer. *`scripts/lib.ts`.*
12. **Waiters that matched themselves.** `pgrep -f "render_chapter.ts"` inside a loop whose own command line contains
    that string never finishes. Hit four times across three agents. → Wait on a PID, a lock or an output file, never on
    `pgrep -f` with a pattern from your own command. *WORKFLOW machine rules.*
13. **A monitor waited all night for a job that never started.** → A monitor that waits for a sentinel also checks a
    liveness signal (PID or log time) and fails when the producer is gone; a handoff cites evidence the job was launched
    (PID, log path, first log line). *WORKFLOW.*
14. **Edits during a render killed it.** An engine edit reloaded the page mid-render. → Never edit an episode's engine
    while it renders; the render scripts block hot reload. *`scripts/lib.ts`, WORKFLOW.*
15. **The new-episode checklist deleted `renders/`**, so three chapter renders failed to move into place. → `nx init`
    creates the folders; render scripts create missing folders. *Tools.*

## Tokens (measured)

16. **Waiting is what made builds expensive.** Subagent prompt caches expire after about 5 minutes. A builder call that
    waited longer (on a render, the render lock, or a sleep) re-wrote its whole context: 15.8M of one builder's
    16.4M cache-write tokens came from 27 such calls. → No agent-facing tool blocks more than about 4 minutes
    (`--budget`, exit 75 "lock busy, rerun"); queue long jobs and end the turn. *All scripts, WORKFLOW.*
17. **Builders paged through old episodes' scene code** to find reusable helpers (21 % of builder tokens). →
    `kit_index.ts` (an index of every helper plus `show <name>`). *Tools.*
18. **The orchestrator drove a browser upload click by click** (about 2M tokens). → Mechanical multi-step flows
    (uploads, batch edits) go to a script that stops at the first unexpected state, not to step-by-step tool calls.
    *WORKFLOW (orchestrator habits).*

## Privacy

19. **The user's email went into third-party requests** (an API parameter and a User-Agent), composed ad hoc by
    agents. → Agents download only through `fetch_ref`, whose fixed User-Agent contains no personal data. *Tools.*
20. **Agents launched for the user on a different model** than the one the user was using, without saying so. → State
    the tool and model when launching work for the user; default to the user's current model. *WORKFLOW.*

## Tool limits found in use

21. **`refart clean` on densely hatched engravings** treated the organ's own striations as text and erased most of the
    anatomy (first real use, a kidney plate). The builder masked only label and leader pixels by hand, then inpainted.
    → Prefer plates whose labels sit outside the subject; on hatched plates give `refart clean --region x,y,w,h` per label and
    `--keep` over the anatomy rather than relying on automatic detection, and check the before/after preview at full size.

## Speed (measured)

22. **Renders took about 2 h per episode, and the browser was not the bottleneck.** Measured on a production engine,
    the page drew and read back a 1080p frame (4 sub-frames) in about 7 ms. Production ran at 7–17 fps because each
    6.2 MB rgb24 frame crossed a WebSocket capped at about 120 MB/s. libx264 `medium` then competed with Chromium for
    the CPU, while the GPU's hardware encoder sat idle. Every Short was also rendered a second time and re-encoded with
    x264 slow, and the frames were acknowledged on receipt rather than after the write, so RAM could pile up behind a
    slow encoder.
    → The page packs I420 on the GPU (half the bytes, no swscale), `h264_vaapi` encodes at 25 Mbit/s, and acks follow
    the ffmpeg write. Two render slots allow `--jobs 2`, and Shorts come out of the chapter pass. Measured: 17 → 36 fps
    for one chapter (1.2× real time), about 60 fps with two jobs, and 138 fps with the opt-in WebCodecs encoder.
    Before optimising, profile each stage in isolation: draw, readback, transport and encode.
    *`encode.ts`, `render_chapter.ts`, `lib.ts`, `make_shorts.py`.*

## Later rounds (measured on the episodes that followed)

23. **Builders that started background jobs paid for them twice.** A builder that queued its own render (or a
    watcher) was woken by the completion notice after its prompt cache had expired, and re-wrote 150–250k tokens of
    context. → Builders never start background jobs and never render: they write `engine/work/renders/CK.ready`
    and stop; the orchestrator owns one queue (`render --all-pending --jobs 2`, then `wait-renders`).
    *AGENT_WORKFLOW.*
24. **Full-width translation panels squeezed the mechanism.** Long statistical panels left a ~380 px strip for the
    plate, unreadable on a TV, and several chapters were redone. → `paperBeat` (side column outside Shorts, page →
    panel → plate inside one) plus a quote budget (≤ 30 words, ≤ 3 numbers; Shorts ≤ 20 or a `tr_short`), checked
    by `tools/quote_budget.py` before voicing and by qa (`squeeze`, `[paperBeat]` cue errors) after.
    *`_papers.ts`, STYLE_GUIDE §E.*
25. **A `sed -i` that changed nothing re-rendered three chapters.** Pending was decided by file times. → Pending is
    by content hash, cached across runs by (size, mtime, inode) in `engine/work/renders/.sha-cache.json`. *`lib.ts`.*
26. **`qa --lines c5-l2b` found nothing.** Line ids were upper-cased before lookup, so mixed-case ids never matched.
    → Line ids match case-insensitively and keep their spelling. *`qa.ts`.*
27. **Scaffolding by hand cost time at every step** (copy, sed, delete, install, data, captions, port). → One command,
    `tools/nx new … --fake-vo --selftest`, which also writes per-chapter packs so builders read one file instead of
    six. *`tools/new_episode.py`.*
28. **The orchestrator ran to 514k context without compacting**, and context above 150k alone cost 5.1M tokens in one
    episode. The next episode, with a compact first and every side task delegated, cost 54 % less per finished
    minute. → Compact at about 150k and before any long idle; delegate blocking work; one fresh chat per episode,
    started from a short handoff file. *AGENT_WORKFLOW (orchestrator).*
29. **Acronyms respelled in the script text** broke cues, captions and fact-check matching. → The script stays
    canonical; `voice.pronounce` respells only what the TTS hears, and the aligned words map back. *`tools/pron.py`.*
