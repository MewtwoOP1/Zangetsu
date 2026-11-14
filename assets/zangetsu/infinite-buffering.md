---
id: infinite-buffering
title: Playback buffers forever, or stalls part-way through
topic: playback
platform: any
versions: all current releases
keywords: buffering, stuck, loading forever, stalls, freeze, slow to start, network, weak connection
questions: It buffers forever | playback keeps loading | the video stops halfway | it freezes | buffering on wifi
sourceUrl: https://zangetsu.online/guide/#04-when-something-wont-play
sourceType: official
checkedAt: 2026-11-14
confidence: high
outdated: false
---
Usually the source, not the app. Work through these in order.

1. **Try a different server.** Open the sources sheet in the player and pick another one. If a second server plays, the first is dead.
2. **Try a different source for the same title.** A source written for last month's layout stops working when a site changes.
3. **Raise the buffer** under **Settings → Playback** if playback dips on a weak connection.
4. **Make sure you are up to date.** Some streams carry a dozen or more audio languages, which can make startup slow, and recent versions handle these much better.
5. **Try an external player** from the player menu — that separates a player problem from a network problem.
6. Run **Settings → Sources → Source health** and remove the sources it marks dead.

If the same source buffers on every title and every server, it is the source. If every source buffers on every title on the same network, it is the network or the device.
