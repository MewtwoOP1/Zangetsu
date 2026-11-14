---
id: audio-video-compatibility
title: Codec support and what plays on which device
topic: playback
platform: any
versions: all current releases
keywords: codec, h265, hevc, av1, vp9, audio track, dolby, atmos, 4k, hdr, unsupported format
questions: Does it play hevc | will it play 4k on my tv | av1 support | why is the audio in another language | atmos not working
sourceUrl: https://zangetsu.online/guide/
sourceType: official
checkedAt: 2026-11-14
confidence: medium
outdated: false
---
The app supports up to **4K and HDR, but only when the stream and the device support it**. The device's own decoder is the limit — an older TV box or stick simply cannot decode a newer codec.

- **Audio**: a stream may carry a dozen or more audio languages, which can make startup slow. Recent versions handle this much better. If startup is slow, make sure you are on the latest build.
- **Video**: if the picture is black but the sound plays, the device likely cannot decode that stream. Try another server or another source, or an external player.
- Choosing a different **quality** in the player changes which file is fetched, and a lower quality is more widely decodable.

A stream that plays on your phone may not play on a cheap TV box, and that is a device limit rather than an app bug.
