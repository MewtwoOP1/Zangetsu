---
id: tv-x86-not-supported
title: The app will not run on an x86 Android TV emulator
topic: tv
platform: android-tv
versions: all current releases
keywords: x86, x86_64, emulator, android studio emulator, android tv emulator, not supported, intel
questions: It does not work on my x86 android tv emulator | android tv x86_64 | will not install on an emulator | intel android tv
sourceUrl: https://github.com/Spyou/Zangetsu/issues/8
sourceType: maintainer
checkedAt: 2026-11-14
confidence: high
outdated: false
---
The builds **deliberately exclude x86 and x86_64 native libraries**, so the app is ARM-only. An x86_64 Android TV emulator will not run it, and this is not a bug that will be fixed.

For an emulator, use an **ARM system image** with hardware acceleration, or test on real hardware.

This is a known limitation rather than a defect, and it is still open on the app's issue tracker.
