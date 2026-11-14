---
id: browser-window-on-play
title: A browser window opens when I press play
topic: playback
platform: any
versions: all current releases
keywords: browser opens, ad page, opens chrome, opens a tab, external browser, ad page on play
questions: Why does a browser open when i play | an ad page opened | it opens chrome every time | a web page opens on play
sourceUrl: https://zangetsu.online/guide/#04-when-something-wont-play
sourceType: official
checkedAt: 2026-11-14
confidence: high
outdated: false
---
Two different things open a browser window, and both are **the source's behaviour, not the app's**:

1. **A Cloudflare check** — some sites sit behind a "checking your browser" screen. The app opens a real browser view so the check can complete. Do it once and it is remembered.
2. **An ad page** — a few sources open an ad page in your browser while resolving a link.

If a source does this **every single time**, it is a bad source; try another one for the same title. Closing the window does not cancel the playback.
