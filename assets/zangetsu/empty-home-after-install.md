---
id: empty-home-after-install
title: The app is empty — where are the sources?
topic: sources
platform: any
versions: all current releases
keywords: empty home screen, no sources, nothing to watch, fresh install, blank app, nothing shows
questions: Why is the app empty? | nothing shows on the home screen | no sources after install | the app is blank | where do the sources come from
sourceUrl: https://zangetsu.online/guide/#02-sources
sourceType: official
checkedAt: 2026-11-14
confidence: high
outdated: false
---
Zangetsu ships with **no sources of its own**. It is a player, not a library — you choose what to add.

1. Open **Settings → Sources**.
2. Pick an ecosystem and **Add repository**.
3. Install the sources you want from it. They then appear in the source switcher at the top of the home screen.

> **A small inconsistency in the project's own documentation.** The official guide says the app starts with nothing, and that the home screen is empty until you add a repository. The README of the app's own default provider repository says that repository "is added on first launch, so users get every source here without doing anything". If your home screen is empty, the answer is the same either way: **add a repository yourself** and install what you want.

The official project does not host, bundle, recommend or link to third-party sources, and support cannot hand you one. A community repository is the community's to run: it can change or disappear without notice, and if one stops loading that is the repository, not the app.

See https://zangetsu.online/guide/#02-sources for the whole picture.
