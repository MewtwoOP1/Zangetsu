---
id: cloud-sync-egress-quota
title: Sync fails with "exceed_egress_quota"
topic: accounts
platform: any
versions: affected around v1.9.8 to v2.3.4
keywords: exceed_egress_quota, sync failed, service restricted, quota, cloud sync not working, account creation failed
questions: Cloud sync says exceed_egress_quota | sync is restricted | error creating a new account | sync stopped working | service for this project is restricted
errorStrings: exceed_egress_quota | Service for this project is restricted
sourceUrl: https://github.com/Spyou/Zangetsu/issues/147
sourceType: maintainer
checkedAt: 2026-11-14
confidence: high
outdated: false
---
This is a **backend** problem, not a bug in your app. The app's sync service runs on a shared backend, and when that backend's traffic quota is exhausted every account is refused at once.

The maintainer's own words: *"Our Supabase project exceeded its egress quota, so cloud sync is temporarily unavailable. Your data on this device remains local; sync should resume once the quota resets."*

1. **Your data on the device is safe.** Nothing is lost; only the sync is paused.
2. **Check whether the newest release has fixed it.** The quota ran out around v2.3.1 and was reported as recovered by v2.3.5.
3. If it is still failing on the latest build, wait and try again — the quota resets on the backend's schedule.

Account creation fails with the same message for the same reason.
