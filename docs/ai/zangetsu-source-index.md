# Where the Zangetsu knowledge comes from

Every source consulted for the app's knowledge base, what was taken from it, and when it was last checked.
Nothing here is a link the assistant may invent: the assistant may only cite a URL that appears in the
[retrieved material](./zangetsu-knowledge.md).

**Last full pass: 2026-11-14.**

---

## Official — the app's own project

These are the sources of truth. Where they disagree with each other, the corpus says so rather than picking
one silently.

| Source | URL | What it gave the corpus |
|:--|:--|:--|
| Official website | https://zangetsu.online/ | The app's identity, what it does and does not do. |
| Official guide | https://zangetsu.online/guide/ | The bulk of the corpus: installation, sources, watching, troubleshooting and Android TV, section by section. |
| Upstream repository | https://github.com/Spyou/Zangetsu | The app's own source code, README, licence and issue templates. |
| Releases | https://github.com/Spyou/Zangetsu/releases | The version history and the release notes that say which fix landed in which build. |
| Issues | https://github.com/Spyou/Zangetsu/issues | Real problems, and the maintainer's answers to them. |
| Security policy | https://github.com/Spyou/Zangetsu/blob/main/SECURITY.md | How to report a vulnerability, and what is out of scope. |
| Bug report template | https://github.com/Spyou/Zangetsu/blob/main/.github/ISSUE_TEMPLATE/bug_report.yml | The exact fields a good report needs. |
| Source-failure template | https://github.com/Spyou/Zangetsu/blob/main/.github/ISSUE_TEMPLATE/source_not_working.yml | The ecosystems and the failure stages a source problem has. |
| Default provider repository | https://github.com/Spyou/zangetsu-providers | The manifest model, and the "added on first launch" claim that disagrees with the guide. |
| Source bridge | https://github.com/Spyou/Zangetsu-Source-Bridge | How Mangayomi-compatible extensions are run. |

> The app's repository has **GitHub Discussions disabled**. Every question and answer lives in issues, the
> Discord, the Telegram channel and Reddit instead.

## The app's own communities

| Where | Link | What it is |
|:--|:--|:--|
| Discord | https://discord.gg/hey6vz9kg6 | The app's support server. |
| Reddit | https://www.reddit.com/r/ZangetsuOfficial | The app's subreddit — **not** r/animeapp. |
| Telegram | https://t.me/ZangetsuStream | The announcement channel. |

---

## What the official sources established

Facts the corpus states as official, with where each came from:

| Fact | Source |
|:--|:--|
| Zangetsu "is a tracking and management tool only — it does not host, provide, distribute, or maintain streaming content or extensions" | README, disclaimer |
| APKs are `arm64-v8a`, `armeabi-v7a`, `universal` and `tv` | README download table |
| The guide's own APK advice: arm64 for phones, TV for TV, universal if unsure | guide, Getting started |
| "Zangetsu ships with no sources at all, on purpose" | guide, Sources |
| "We don't host, bundle, recommend or link to any source" | guide, Sources |
| Settings paths: `Settings → Sources`, `Settings → Sources → Source health`, `Settings → Check for updates`, `Settings → Advanced → Share logs`, `Settings → Playback`, `Settings → Connections → Connect` | guide, README, release notes |
| "Zangetsu is a tracking and management tool only" | README |
| iOS is a TestFlight beta; CloudStream, Aniyomi and Mihon extensions cannot load there | README, guide |
| Windows is "in progress" | README roadmap |
| x86 and x86_64 libraries are stripped from every build | `android/app/build.gradle.kts`, issue #8 |
| The minimum is API 24 / Android 7.0 | `minSdk = flutter.minSdkVersion` with Flutter 3.44.7, corroborated by issue #138 |
| Stremio addon support landed in v2.3.6 | v2.3.6 release notes |
| Mangayomi extension support landed in v2.3.4 | v2.3.4 release notes |
| Manga and novel modes have no source priority or Auto Resolve | maintainer answer on issue #181 |
| PIN-locked profiles needed a connection to unlock, relaxed in v2.3.5 | v2.3.4 and v2.3.5 release notes |
| Cloud sync failing with `exceed_egress_quota` is a backend quota, not an app bug | maintainer answer on issue #147 |
| NSFW extensions stay hidden until NSFW is switched on | maintainer answers on issues #84, #129, #175 |
| `MediaCodec Embed` in `Settings → Playback → Video renderer` is the black-screen fix | v1.9.3 release notes |
| Watch Party is paused while sync moves to a cheaper backend | v2.3.2 release notes |

## Where the official sources disagree

Two contradictions are recorded in the corpus rather than resolved by guesswork.

| The disagreement | How the corpus handles it |
|:--|:--|
| The guide says the app starts with **no sources**; the default provider repository's README says that repository "is added on first launch" | `empty-home-after-install` states both and gives the same practical answer either way: add a repository yourself. |
| The guide says **Android 5.0+**; the build's own `minSdk` is **API 24 / Android 7.0** | `android-version-requirements` says the build is the authority, quotes the discrepancy, and explains what to do on an older device. |

---

## Community

Community material is used only where the official sources are silent, is labelled `community`, and never
carries `high` confidence. The retrieval test enforces that rule, so a community answer cannot quietly become
an official one.

| Source | What it is used for |
|:--|:--|
| The app's Reddit community | Member questions, symptoms and workarounds, checked against the official sources before use. |
| The app's GitHub issues | Confirmed problem reports with a maintainer's answer. These are treated as `maintainer`, not `community`, because the maintainer answered them. |
| Public forums and search-indexed troubleshooting pages | Only where they restate something the official sources already say. |

### The rule the corpus follows

> A community report is a **lead**, not an answer. It becomes an entry only when it can be checked against
> documentation, the source code, a release note, or reproducible behaviour. When it cannot be checked, it is
> still kept — labelled `community`, confidence `low`, and with the uncertainty stated in the body — because an
> honest "somebody reported this and nobody has confirmed it" is more useful to a member than silence.

---

## What could not be verified

| Gap | Why it matters | How the assistant is told to handle it |
|:--|:--|:--|
| The numeric `targetSdk` of a release | It follows whichever Flutter SDK built that release, and no built APK was decompiled | It is never stated; only the minimum is. |
| Whether an iOS build exists for the newest release | v2.3.6 ships no `.ipa` asset at all | The assistant says iOS is a TestFlight beta and does not claim a build exists for a specific version. |
| Which release closed which issue | Maintainers close issues with "fixed" without always naming a version | The corpus cites the release notes for a fix and the issue for the problem, and does not guess the mapping. |
| Whether a given community workaround still works | Sources break, and community advice ages | Such entries are labelled `community` and `low`, and carry the date they were collected. |
| The runtime behaviour of the sync backend | Only the source and the READMEs were read | The corpus states the quota failure as a backend condition, which is what the maintainer said. |

---

## Keeping the index honest

When the scheduled refresh notices that the official guide has changed, it says so in the log:

```
[KNOWLEDGE] The official guide changed since the last check. Review the stored answers.
```

That is the signal to re-read this page, re-check the entries whose `sourceUrl` points at the guide, and bump
their `checkedAt` date. An entry that is not re-checked keeps its old date, and the assistant is told the date,
so it can say how sure it is.
