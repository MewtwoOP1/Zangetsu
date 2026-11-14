---
id: source-no-playable-servers
title: The source finds the title but there are no playable servers
topic: playback
platform: any
versions: all current releases
keywords: no playable server, no servers, no links, empty server list, extraction failed, resolve failed
questions: Why are there no playable servers? | the episode has no servers | no links found | the server list is empty | nothing to play
sourceUrl: https://zangetsu.online/guide/#04-when-something-wont-play
sourceType: official
checkedAt: 2026-11-14
confidence: high
outdated: false
---
This is a source-side problem far more often than an app problem: the source found the catalogue entry but could not turn it into a stream.

1. **Try another source for the same title.** If one plays, the first source's extraction is broken and there is nothing to fix on your end.
2. **Update the source** — a site that changed its player is the usual cause, and the source usually gets fixed within days.
3. Run **Settings → Sources → Source health** and remove sources it marks dead.
4. Some sites need a browser check before they serve a link. If a browser window opens while you are resolving, complete the check once — the result is remembered.
5. If the episode is recent, the source may not have caught up yet. Try an earlier episode to confirm the source itself still works.

Only if **every** source fails on **every** title is this worth reporting as an app bug — see the bug-report checklist.
