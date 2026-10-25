#!/usr/bin/env bash
# Smoke test: build the example episode (examples/hello) from the template without any TTS key, then run the type
# check, the layout QA, two stills and a 3-second encode. Everything goes under <dest> (default work/smoke-hello,
# git-ignored). Needs bun, ffmpeg, python3 and a Chromium (see docs/CONFIG.md, render.chrome_path).
#   tools/smoke_test.sh [dest] [--keep] [--full]
#     --keep  reuse an existing dest instead of rebuilding it
#     --full  also render both chapter clips (1 sample), assemble the master, write the SRT and the Short, then check
#             their receipts (verify-fresh) and that nothing is pending (~3 min)
# Browser steps take the shared render lock (HARNESS_RENDER_LOCK or the example's episode.json) and wait for free memory.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
dest="$root/work/smoke-hello"
for a in "$@"; do case $a in --*) ;; *) dest="$(realpath -m "$a")" ;; esac; done
nx="$root/tools/nx"
ex="$root/examples/hello"
step() { printf '\n== %s\n' "$*"; }

if [[ " $* " != *" --keep "* ]]; then rm -rf "$dest"; fi
step "init episode at $dest"
"$nx" init "$dest" --id hello --title "How a candle burns" --force >/dev/null
cp "$ex/episode.json" "$ex/script.json" "$dest/"
cp "$ex"/scenes/*.ts "$dest/engine/app/src/scenes/"
( cd "$dest/engine/app" && bun install --silent )

step "script check, fake voice (no TTS key), engine data, captions"
"$nx" fake-vo "$dest" | tail -3
"$nx" prep "$dest" | tail -2

step "typecheck"
"$nx" typecheck "$dest"

step "layout QA (all chapters)"
"$nx" qa "$dest" --every 1 | tail -8

step "scene text at each line's end (captions off), one full-res still"
"$nx" qa "$dest" --texts C0 --at end | tail -2
"$nx" qa "$dest" --still C1-L1 --at end | tail -1
"$nx" typecheck "$dest" c0 c1 | tail -1
python3 "$root/tools/test_receipts.py" 2>&1 | tail -1

step "stills at 1.5 s and 9 s"
"$nx" stills "$dest" --t 1.5,9 | tail -2

step "3-second encode"
out="$dest/engine/work/renders/smoke.mp4"
"$nx" encode "$dest" --from 0.5 --to 3.5 --samples 1 --only auto --quiet --out "$out"
frames=$(ffprobe -v error -count_packets -select_streams v:0 -show_entries stream=nb_read_packets -of csv=p=0 "$out")
echo "frames: $frames (want 90)"
[ "$frames" -ge 89 ] && [ "$frames" -le 91 ]

if [[ " $* " == *" --full "* ]]; then
  step "chapter clips, master, subtitles, Short"
  "$nx" render "$dest" C0 C1 --samples 1
  "$nx" assemble "$dest" | tail -1
  "$nx" srt "$dest"
  "$nx" shorts "$dest" --samples 1 | tail -1
  "$nx" verify-fresh "$dest" "$dest"/renders/hello_full.mp4 "$dest"/shorts/*.mp4
  "$nx" render "$dest" --all-pending --dry-run
fi
step "smoke test passed"
