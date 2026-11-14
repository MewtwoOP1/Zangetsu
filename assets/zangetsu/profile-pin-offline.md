---
id: profile-pin-offline
title: A PIN-locked profile will not unlock without internet
topic: accounts
platform: any
versions: v2.3.4 introduced, v2.3.5 relaxed
keywords: pin, profile unlock, needs internet, offline unlock, fingerprint, face id, 4 digit, 6 digit
questions: My profile pin needs internet | cannot unlock my profile offline | the pin asks for a connection | profile lock will not work offline
sourceUrl: https://github.com/Spyou/Zangetsu/releases/tag/v2.3.5
sourceType: official
checkedAt: 2026-11-14
confidence: high
outdated: false
---
Profile protection arrived in v2.3.4 with a **4- or 6-digit PIN** that works across devices, plus optional fingerprint or Face ID unlock.

At first the PIN needed an internet connection to unlock. **v2.3.5 relaxed that**: you can use a profile's saved PIN offline, after unlocking that profile **online once on the same device**.

So on the latest build, unlock the profile once while you are online, and it will unlock offline afterwards. On v2.3.4 and earlier, the connection is required every time.
