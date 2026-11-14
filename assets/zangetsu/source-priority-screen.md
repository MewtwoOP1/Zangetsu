---
id: source-priority-screen
title: Source Priority and how Auto Resolve picks a source
topic: sources
platform: any
versions: v2.2.0 and later
keywords: source priority, priority order, auto resolve, source slider, where the app stops looking, parallel search
questions: What is source priority | how does auto resolve work | can i reorder my sources | how many sources does it check | the slider in sources
sourceUrl: https://github.com/Spyou/Zangetsu/releases/tag/v2.3.3
sourceType: official
checkedAt: 2026-11-14
confidence: high
outdated: false
---
**Source Priority** is a numbered list of your sources, with a slider for how many of them the app will consult. It was rebuilt in v2.2.0 and refined afterwards.

- Sources are queried **in parallel**, and a slow source no longer holds up the others.
- The list shows **where the app stops looking**, so the number you set is the number of sources it will try.
- A source **you pinned by hand is not swapped out** when one of its links dies.
- A dead link **walks to the next source by itself**, up to three, and a failure message names the sources that never answered.

**Auto Resolve** (visible from v2.3.3) shows which source it is checking and can be stopped. It checks up to **20 sources**.

On Android TV there is a TV version of the Source Priority screen, and v2.3.5 made the Source Health screen scrollable with a remote.

**Manga and light novels are the exception**: Auto Resolve does not support manga streaming providers, so there is no source priority system for them. That is a stated limitation, not a setting you are missing.
