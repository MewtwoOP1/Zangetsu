---
id: bug-report-checklist
title: How do I report a bug?
topic: errors
platform: any
versions: all current releases
keywords: report a bug, issue, github issue, crash report, feedback, send logs, reference code
questions: How do i report a bug | where do i report an issue | how do i send a bug report | the app crashed, what do i send | is there an issue tracker
sourceUrl: https://github.com/Spyou/Zangetsu/blob/main/.github/ISSUE_TEMPLATE/bug_report.yml
sourceType: official
checkedAt: 2026-11-14
confidence: high
outdated: false
---
If a problem is really the app's, it gets fixed faster with these — they are the fields the project's own bug form asks for:

1. **App version** — the exact build, not just "the latest".
2. **Device type** — phone or tablet, Android TV / TV box / stick, or iOS TestFlight.
3. **Device and Android version.**
4. **Which APK you installed** — arm64-v8a, armeabi-v7a, universal or tv.
5. **Which area** — player, reader, sources, downloads, trackers, TV interface, search or other.
6. **The source and extension ecosystem involved**, if relevant — the ecosystem is Zangetsu JS, CloudStream, Aniyomi, Mihon or LNReader, and the failure stage is "will not install", "search", "title", "play" or "mid-playback".
7. **The exact error message**, copied rather than described.
8. **How to reproduce it** — what you did, step by step.
9. **Whether it affects one title or all of them**, and **whether it started after an update**.
10. **Logs** — **Settings → Advanced → Share logs** gives a short reference code, with secrets stripped before anything leaves the phone.

Before sending, run **Settings → Sources → Source health** and try the same title on another source. The project's own form says it plainly: *"a lot of reports turn out to be one source being down rather than the app"*. Several issues on the tracker were closed as "Source issue".

Where to send it: https://github.com/Spyou/Zangetsu/issues
And for a **vulnerability**, use the repository's private vulnerability reporting rather than a public issue.
