---
id: repository-fails-to-load
title: A repository will not load
topic: sources
platform: any
versions: all current releases
keywords: repo failed to load, cannot add repository, invalid repo, empty repository list, manifest error
questions: The repository will not load | i cannot add a repository | the repo url is not working | adding a repo gives an error | no sources listed after adding repo
sourceUrl: https://zangetsu.online/guide/#02-sources
sourceType: official
checkedAt: 2026-11-14
confidence: medium
outdated: false
---
1. **Check the URL.** It is usually a `https://` link to a manifest or `index.json`. A link to a repository's home page rather than its manifest will load nothing.
2. **Check you are online**, and that the URL opens in a normal browser. A manifest that does not open in a browser will not load in the app either.
3. **The repository may be gone.** Community repositories can change or disappear without notice, and a removed repository cannot be added.
4. **Remove it and add it again** if it used to work — the app caches what it read.
5. Make sure you added it under the **right ecosystem**. A CloudStream repository added under Aniyomi will not list anything.

If the URL opens in a browser and shows a list of sources, and the app still shows nothing, that is worth a bug report — see the bug-report checklist.
