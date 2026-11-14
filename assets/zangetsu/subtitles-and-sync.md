---
id: subtitles-and-sync
title: Subtitles are missing, out of sync, or not rendering
topic: playback
platform: any
versions: all current releases
keywords: subtitles, subs, captions, subtitle track, sync, timing, no subtitle track, styling
questions: There are no subtitles | subtitles are out of sync | the subtitles do not show | how do i turn subtitles on | subtitle styling
sourceUrl: https://zangetsu.online/guide/#03-watching-something
sourceType: official
checkedAt: 2026-11-14
confidence: medium
outdated: false
---
**Subtitle tracks depend on the source.** A source that does not publish subtitle files cannot offer them, and the app cannot invent them.

1. Open the **sources sheet** in the player and try another server for the same episode. Servers of the same source can differ in whether they carry subtitles.
2. Check the subtitle menu in the player for a track list. If the list is empty, that stream carries none.
3. If a track exists but the text is wrong or late, the timing comes from the source's file. Try another server or another source.
4. **Styling** — size, background and outline — is set in the player, and applies to the tracks the stream actually carries.
5. On **Android TV**, subtitle rendering depends on the TV's own subtitle support as well as the app's. Test the same episode on a phone to tell the two apart.

If subtitles work on a phone and not on the TV, it is the TV's handling of them. If they fail everywhere on one source, it is the source's files.
