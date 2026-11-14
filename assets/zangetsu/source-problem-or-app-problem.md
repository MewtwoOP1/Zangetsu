---
id: source-problem-or-app-problem
title: Is this the app's fault or the source's?
topic: troubleshooting
platform: any
versions: all current releases
keywords: is it a bug, app or source, whose fault, isolate, distinguish, third party provider
questions: Is this a bug in zangetsu? | is it my source or the app | whose fault is this | how do i tell if the app is broken
sourceUrl: https://zangetsu.online/guide/#04-when-something-wont-play
sourceType: official
checkedAt: 2026-11-14
confidence: high
outdated: false
---
Almost always the **source** rather than the app. Sites break, move domain, add bot protection or simply go down, and a source written for last month's layout stops working.

A quick isolation:

1. **One title, one source** — if only one title fails, it is that title or that source.
2. **One title, every source** — if the same title fails on every source, it is that title's catalogue entry, not the app.
3. **Every title, one source** — that source is broken.
4. **Every title, every source, one device** — the app, the device or the network.
5. **Every title, every source, every device** — then it is worth reporting as an app bug.

Sources are community-maintained and can go down without the app knowing. The app's project does not run, endorse or control them, so the fix usually belongs to the source's author — and telling them is what makes it get fixed.

See the bug-report checklist for what to send when it really is the app.
