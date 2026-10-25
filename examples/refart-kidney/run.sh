#!/usr/bin/env sh
# Reference-art pipeline, end to end, on Gray's Anatomy fig. 1127 (coronal section of the kidney, 1918, public domain):
# the plate a scene builder once abandoned after rectangle masks cut the anatomy. Run from the repo root.
#   1. find + download (writes SOURCES.md)   2. clean labels by inpainting   3. trace to engraved line art
# Automatic detection removes the bold labels and the Hilum leader line; the --region hints cover small labels the
# detector misses. Known residue: the tiny italic labels inside the lower pyramid (Infundibulum, Papilla, Calyx,
# Pyramid) touch the striations and stay readable at full size; inpainted spots in the hatched cortex read as blank
# patches. The source is only 417x700 px, so the trace is soft when shown large.
set -e
E=examples/refart-kidney
tools/refart.py find "Gray kidney section vertical" --sources commons --limit 5 --dest $E --download 1
tools/refart.py clean $E/commons_Kidney_section_vertical.png -o $E/kidney_clean.png \
  --region 186,178,56,22 --region 108,336,30,40 --region 168,296,60,24 --region 172,483,62,22 \
  --region 350,630,35,70 --region 96,260,24,28
tools/refart.py trace $E/kidney_clean.png -o $E/kidney_trace.png
