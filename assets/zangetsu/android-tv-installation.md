---
id: android-tv-installation
title: How do I install Zangetsu on an Android TV?
topic: install
platform: android-tv
versions: all current releases
keywords: android tv, tv box, firestick, shield, sideload, tv build, d-pad, 32-bit
questions: How do i install it on my tv? | does zangetsu work on android tv | firestick install | tv box says app not compatible
sourceUrl: https://zangetsu.online/guide/#05-on-your-tv
sourceType: official
checkedAt: 2026-11-14
confidence: high
outdated: false
---
Use the **TV build** from the releases page: https://github.com/Spyou/Zangetsu/releases/latest

1. Many TV boxes and sticks are still 32-bit, so the arm64 phone build will crash on them. The TV build is the one to use.
2. Sideload it however you normally do — the app detects the TV and switches to a D-pad interface automatically.
3. On Fire TV, use the TV build too. Sideloading on Fire TV normally means enabling Apps from Unknown Sources in Developer Options and using a sideloading app or ADB.
