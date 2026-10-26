# Add the Spanish (Latin America) audio track to the trailer

Video: https://youtu.be/ToCa9712bxg (vibe-animator trailer, 2:44).
File: `examples/trailer/i18n/es-419/trailer_es_audio.m4a`. It is AAC 320 kbps, 48 kHz stereo, exactly 164.252 s (the master's
length), mixed to -14 LUFS with true peak at -1.7 dBTP. It is not in git: it sits in the working copy next to this file.
Check it first with `trailer_es_preview.mp4` (the master picture with the Spanish audio).

The YouTube Data API has no endpoint for audio tracks (checked 2026-10-25). The title, description and captions are
already set through the API (es-419 localization plus the "Español (Latinoamérica)" caption track). Only the audio has
to be added by hand.

## Steps (desktop browser, signed in to the channel that owns the trailer)

1. Open https://studio.youtube.com and confirm the channel shown at the top right is the one that owns the trailer.
2. In the left menu, click **Content**.
3. Hover over the trailer row ("vibe-animator: describe a video, Claude Code agents make it (trailer)") and click its
   title or the pencil (**Details**).
4. In the video's left menu, click **Languages**. (In some Studio versions this item is still called **Subtitles**.)
5. Spanish (Latin America) should already be listed, because the API added the es-419 title, description and captions.
   - If it is listed, go to its row.
   - If it is not, click **Add language**, choose **Spanish (Latin America)** / «Español (Latinoamérica)», and go to
     the new row.
6. If the row already shows an **automatic dub**, delete it first: hover over it, open the menu (⋮), choose
   **Delete**. Your own track cannot be uploaded while an auto-dub exists for that language.
7. In the **Audio** column of that row, click **Add** (or **Add dub**).
8. Click **Select file** and choose `trailer_es_audio.m4a`.
9. Wait for the check to finish. The track has to match the video's length, and this file matches it exactly.
10. Click **Publish**. (Use **Save as draft** if you want to listen to it in the Studio player first.)
11. Check: open https://youtu.be/ToCa9712bxg, then **Settings (gear) → Audio track**. It should list English (original)
    and Spanish (Latin America). Pick Spanish and listen to the opening, the al-Khwarizmi section (0:46) and the
    Kepler section (1:58).

## If there is no "Audio" column or "Add dub" option

The channel does not have the multi-language audio feature yet. YouTube rolls it out gradually to channels that have
**advanced features** turned on (Studio → Settings → Channel → Feature eligibility). Do not wait for it. Fall back to:

1. Upload `trailer_es_preview.mp4` as a separate video with the Spanish title and description (the es-419 texts already
   on the video's localization), `defaultLanguage`/`defaultAudioLanguage` = `es-419`, the
   `subtitles.es-419.srt` captions, and the same thumbnail. Upload it private first, as usual.
2. Add one line to both descriptions linking each version to the other:
   - English video: `Versión en español: https://youtu.be/<spanish id>`
   - Spanish video: `English version: https://youtu.be/ToCa9712bxg`
3. Make the Spanish video public once it has been checked.

When the feature turns up later, add the audio track to the original video, then make the separate Spanish upload
unlisted, so that views gather on one video.
