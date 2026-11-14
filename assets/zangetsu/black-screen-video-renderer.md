---
id: black-screen-video-renderer
title: Black screen while the sound plays — change the video renderer
topic: playback
platform: android
versions: v1.9.3 and later
keywords: black screen, media codec, video renderer, embed, older gpu, no picture, mediacodec embed
questions: The screen is black but sound plays | how do i change the video renderer | media codec embed | black screen on an old phone
sourceUrl: https://github.com/Spyou/Zangetsu/issues/17
sourceType: maintainer
checkedAt: 2026-11-14
confidence: high
outdated: false
---
The app has a **video renderer** setting, and switching it is the documented fix for a black picture with working sound on older devices.

1. Open **Settings → Playback → Video renderer**.
2. Choose **MediaCodec Embed** rather than the mpv GPU renderer.
3. Play the same episode again.

The mpv GPU renderer cannot run on some older GPUs, which produces exactly this: audio, no picture.

**The trade-off:** on the MediaCodec Embed renderer, **Anime4K and subtitle styling are unavailable**. If you need those, change back and try another server or source instead.

The app's own tracker also fixed a black screen on some Android 8 and Fire TV devices in v1.9.1, so an update is worth trying before changing anything.
