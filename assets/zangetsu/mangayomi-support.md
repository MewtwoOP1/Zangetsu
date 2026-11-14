---
id: mangayomi-support
title: Mangayomi extensions
topic: sources
platform: any
versions: v2.3.4 and later
keywords: mangayomi, extension format, new format, compatible extensions, source bridge
questions: Does zangetsu support mangayomi extensions | what is mangayomi | which extension formats are new
sourceUrl: https://github.com/Spyou/Zangetsu/releases/tag/v2.3.4
sourceType: official
checkedAt: 2026-11-14
confidence: medium
outdated: false
---
**Mangayomi** extension support was added in **v2.3.4**. Mangayomi-compatible extensions run inside the app through a source bridge that runs the extension code in an isolated worker, with timeouts and cancellation.

The other formats are unchanged:

- **Zangetsu** — the app's own lightweight JavaScript sources.
- **CloudStream** — `.cs3` extensions.
- **Aniyomi / Mihon** — Android extension packages, for anime and manga respectively.
- **LNReader** — light novel plugins.
- **Stremio** — addon manifests, since v2.3.6.

An extension that is not one of these formats will not install, and the app says so rather than failing silently.
