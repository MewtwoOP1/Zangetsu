---
id: cloudflare-challenge
title: A Cloudflare "checking your browser" page appears
topic: playback
platform: any
versions: all current releases
keywords: cloudflare, checking your browser, bot protection, challenge, verify you are human, captcha
questions: What is this cloudflare page? | checking your browser | cloudflare challenge | it asks me to prove i am human | verify you are human
sourceUrl: https://zangetsu.online/guide/#04-when-something-wont-play
sourceType: official
checkedAt: 2026-11-14
confidence: high
outdated: false
---
Some sites sit behind a **"checking your browser" screen**. The app opens a real browser view so the check can complete.

1. **Complete the check once** in that window.
2. The result is **remembered**, so it should not ask again.
3. If a source does this **every single time**, it is a bad source — try another one for the same title.

This is the site's own bot protection reacting to the app's request, not an app error and not something the app can disable. Nobody has found a way past it that the project would ship, and it is not a bug to report.
