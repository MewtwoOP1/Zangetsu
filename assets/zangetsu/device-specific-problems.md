---
id: device-specific-problems
title: Problems that only happen on one device
topic: troubleshooting
platform: any
versions: all current releases
keywords: only on my phone, works on tv not phone, device specific, samsung, xiaomi, oneplus, emulator, chromebook
questions: It only happens on my phone | works on tv but not phone | device specific problem | it works on my other device | chromebook android app
sourceUrl: https://zangetsu.online/guide/
sourceType: official
checkedAt: 2026-11-14
confidence: medium
outdated: false
---
Before reporting anything, establish that it is the app and not the device:

1. **Play the same title, same source, same server on another device.** If it works there, the problem is the device — its decoder, its Android version, its network, or a battery-optimisation setting killing the app in the background.
2. **Check the Android version.** The app needs a current Android release, and the exact minimum for your build is on the releases page.
3. **Check battery optimisation and background restrictions.** Aggressive vendor ROMs (Samsung, Xiaomi, OnePlus and others) can kill a media app mid-playback, which looks exactly like a playback bug.
4. **Check free storage** if downloads fail, and the notification permission if nothing appears to happen.
5. **Update the app.** Vendor ROMs and the app change independently, and an old build on a new ROM is a common combination of problems.

Report it with the device model, the Android version and the app version, and say whether it reproduces on another device. That trio is what makes a device-specific report actionable.
