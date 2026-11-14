---
id: black-screen
title: The video is black, but the audio plays
topic: playback
platform: any
versions: all current releases
keywords: black screen, no picture, video not showing, screen stays black, codec, hardware decode
questions: The screen is black but i hear sound | no picture | video is black | the picture does not show
sourceUrl: https://zangetsu.online/guide/#04-when-something-wont-play
sourceType: official
checkedAt: 2026-11-14
confidence: medium
outdated: false
---
Audio playing with a black picture usually means the **device cannot decode that stream**, not that the app failed.

1. **Try another server or another source** for the same episode. A different file or a different quality often decodes.
2. **Try an external player** from the player menu. If the picture appears there, the app's own decoder is the problem.
3. Update the app — playback decoding is fixed regularly.
4. On a TV box or stick, check that the device's own video settings have not been changed, and that the box is not running an out-of-date firmware.

Hardware decoding is not always available for every codec. A stream that another device plays fine can fail on an older box with an older decoder.

If it is black on **every** source and **every** title, that is worth a bug report — see the bug-report checklist.
