---
id: android-version-requirements
title: Which Android version does Zangetsu need?
topic: install
platform: android
versions: v2.3.x and later
keywords: android version, minimum sdk, android 7, android 5, requirements, compatibility, install failed older sdk
questions: What android version do i need? | minimum android version | will it run on my phone | is it compatible with android 10 | android 5 support
errorStrings: INSTALL_FAILED_OLDER_SDK
sourceUrl: https://github.com/Spyou/Zangetsu/blob/main/README.md
sourceType: maintainer
checkedAt: 2026-11-14
confidence: medium
outdated: false
---
**The build's own minimum is Android 7.0 (API 24).** The app does not pin `minSdk`; it follows the Flutter SDK's default, which has been API 24 since Flutter 3.35. The release builds are made with Flutter 3.44.7.

> The public guide still says "Android 5.0+", and the app's README does not name a minimum at all. The two disagree. **The build is the authority** — if Android refuses the APK with `INSTALL_FAILED_OLDER_SDK`, the device is below what that build needs.

If you have an Android 5 or 6 device, the practical options are:

1. Try the **universal** build of an **older release**, which was built against an older minimum.
2. Check whether a still-running community build supports it.

Android 7.0 is confirmed working: it is the version on the low-end Android TV box in the app's own issue tracker, where playback was fixed in the v2.3.x line.
