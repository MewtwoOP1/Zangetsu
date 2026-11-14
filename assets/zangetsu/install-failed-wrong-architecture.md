---
id: install-failed-wrong-architecture
title: Installing fails, or the app closes the moment it opens
topic: install
platform: android
versions: all current releases
keywords: install failed, crash on launch, wrong architecture, no matching abis, closes immediately
questions: The app will not install | installing fails | the app crashes on launch | it closes immediately | no matching abis
errorStrings: INSTALL_FAILED_NO_MATCHING_ABIS | INSTALL_FAILED_OLDER_SDK | INSTALL_FAILED_UPDATE_INCOMPATIBLE | INSTALL_PARSE_FAILED_NO_CERTIFICATES
sourceUrl: https://zangetsu.online/guide/#01-getting-started
sourceType: official
checkedAt: 2026-11-14
confidence: high
outdated: false
---
You almost certainly have the wrong architecture. Install the **universal** build instead.

1. Uninstall the app so no half-installed copy is left behind.
2. Download the universal APK from the releases page: https://github.com/Spyou/Zangetsu/releases/latest
3. Install it over the top. Your data is kept.

If the app still closes on launch, the device's Android version may be below what the build needs. Check the app's minimum Android version on the releases page, and make sure the device is on a current Android release.
