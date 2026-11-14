---
id: app-permissions
title: What permissions does Zangetsu ask for?
topic: settings
platform: android
versions: all current releases
keywords: permissions, notification permission, storage, overlay, battery optimisation, background, microphone
questions: Why does it want notifications | what permissions does it need | battery optimisation | why is storage permission requested
sourceUrl: https://zangetsu.online/guide/
sourceType: official
checkedAt: 2026-11-14
confidence: low
outdated: false
---
The app needs the usual Android permissions for a media player: **notifications** (for downloads and playback), and **storage** access on older Android versions where downloads are written to shared storage.

On Android 13 and later, the notification permission is asked for at runtime and refusing it does not stop playback — it only removes the download and playback notifications.

If downloads fail with a storage error, check that the app is allowed to write to the folder you chose in settings. If background downloads are stopped, exclude the app from battery optimisation.

The exact set changes between releases, so if a permission looks unexpected, say which app version and Android version you are on.
