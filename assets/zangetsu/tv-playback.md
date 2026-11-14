---
id: tv-playback
title: Watching on a TV: codecs, buffering and the remote
topic: tv
platform: android-tv
versions: all current releases
keywords: tv buffering, tv codec, tv picture, tv remote during playback, tv black screen, tv subtitles
questions: Buffering on the tv | tv shows a black screen | subtitles do not show on tv | playback is choppy on tv | tv remote during playback
sourceUrl: https://zangetsu.online/guide/#05-on-your-tv
sourceType: official
checkedAt: 2026-11-14
confidence: medium
outdated: false
---
The TV build is the app with a remote interface, so the same source problems apply, plus a few that come from the device.

1. **Use the TV build**, not the arm64 phone build. Many TV boxes and sticks are still 32-bit and the phone build will crash on them.
2. **Buffering** — try another server in the sources sheet, then another source, then raise the buffer under **Settings → Playback**.
3. **Black picture with sound** — the box may not have a decoder for that stream. Try another server, another source, or an external player.
4. **Subtitles** — the TV's own subtitle support matters as well as the app's. Test the same episode on a phone to tell the two apart.
5. **Slow startup** — some streams carry a dozen or more audio languages. Recent versions handle this much better, so keep the app updated.
