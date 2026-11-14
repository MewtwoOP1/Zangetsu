---
id: which-apk-to-download
title: Which APK should I download?
topic: install
platform: android
versions: all current releases
keywords: apk, download, arm64-v8a, armeabi-v7a, universal, tv build, architecture, install
questions: Which APK do I download? | what apk do i need | arm64 or universal | which build for my phone | what is the difference between the apks
sourceUrl: https://github.com/Spyou/Zangetsu/blob/main/README.md
sourceType: official
checkedAt: 2026-11-14
confidence: high
outdated: false
---
Releases carry several APKs because one file for every device would be needlessly large. The asset names follow the pattern `Zangetsu-vX.Y.Z-<build>.apk`.

| Asset | Recommended for |
|:--|:--|
| `Zangetsu-vX.Y.Z-arm64-v8a.apk` | Modern 64-bit Android devices — **recommended** |
| `Zangetsu-vX.Y.Z-armeabi-v7a.apk` | Older 32-bit Android devices |
| `Zangetsu-vX.Y.Z-universal.apk` | Not sure? Works on everything, but larger |
| `Zangetsu-vX.Y.Z-tv.apk` | Android TV devices |

- Nearly every modern phone wants **arm64-v8a**. Start there.
- If it will not install, use the **universal** build.
- For Android TV use the **TV build**. Many TV boxes and sticks are still 32-bit, and the arm64 phone build will crash on them.
- The **TV build is the universal build** with the leanback launcher added, so it is the same size.

Downloads are on the upstream project's releases page: https://github.com/Spyou/Zangetsu/releases/latest

**Not supported:** x86 and x86_64 native libraries are stripped from every build, so the app does not run on an x86 Android TV emulator.
