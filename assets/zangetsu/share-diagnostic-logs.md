---
id: share-diagnostic-logs
title: Sending a diagnostic log
topic: errors
platform: any
versions: v2.1.0 and later
keywords: share logs, diagnostic log, crash report, send logs, advanced settings, log code, report a crash
questions: How do i send a log | how do i report a crash with logs | where is share logs | diagnostic log | i want to send a bug report
sourceUrl: https://github.com/Spyou/Zangetsu/releases/tag/v2.1.0
sourceType: official
checkedAt: 2026-11-14
confidence: high
outdated: false
---
1. Open **Settings → Advanced → Share logs**.
2. The app uploads the log and hands you a **short reference code**, rather than dropping a file into a share sheet and hoping.

**Secrets are stripped before anything leaves the phone**, so the log does not carry your tokens or your account details.

Include that code when you report a problem — it is what lets the maintainer find your session in the log store.

The app's issue tracker is at https://github.com/Spyou/Zangetsu/issues
