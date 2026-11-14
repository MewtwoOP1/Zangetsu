# The Zangetsu app knowledge base

How the assistant answers questions about the **Zangetsu app** — the media player at
[zangetsu.online](https://zangetsu.online/), whose own source code is at
[Spyou/Zangetsu](https://github.com/Spyou/Zangetsu).

> [!IMPORTANT]
> Two different projects are called Zangetsu. This document is about the **app**. The Discord bot people are
> talking to lives at [MewtwoOP1/Zangetsu](https://github.com/MewtwoOP1/Zangetsu) and is a separate project with
> separate responsibilities. The assistant is told which is which, and is told to stop at the boundary.

---

## What lives where

| Piece                              | Where                             | What it holds                                                                                 |
| ---------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------- |
| The written corpus                 | `assets/zangetsu/*.md`            | One file per answer: the question, the answer, and where the answer came from.                |
| The loader                         | `src/lib/knowledge/knowledgeArticles.util.ts` | Reads and validates the corpus, once, at start-up.                                |
| The retriever                      | `src/lib/knowledge/knowledgeSearch.util.ts` | Scores a question against the corpus and returns the entries that answer it.       |
| The prompt builder                 | `src/lib/knowledge/knowledgeContext.util.ts` | Renders retrieved entries and live facts into the block the model reads.        |
| The live facts                     | `src/lib/knowledge/knowledgeLive.util.ts` | The latest release, the release notes, and the state of the official guide.        |
| The scheduled refresh              | `src/jobs/knowledgeRefresh.util.ts` | Fetches what changed, and says so when something did not.                              |
| The answer itself                  | `src/lib/assistant/zangetsuAssistant.util.ts` | Puts it all together and calls Groq.                                          |

The corpus is **Markdown with frontmatter**, in the same shape as the bot's own help articles in
`assets/support/`. A person can correct an answer by editing one file; nothing needs recompiling.

---

## The shape of an entry

```markdown
---
id: how-to-add-a-repository
title: How do I add a repository?
topic: sources
platform: any
versions: all current releases
keywords: add repository, settings sources, paste url
questions: How do i add a repository? | where do i paste the repo url
errorStrings: |
sourceUrl: https://zangetsu.online/guide/#02-sources
sourceType: official
checkedAt: 2026-11-14
confidence: high
outdated: false
---
1. Open **Settings → Sources**.
...
```

| Field          | What it means                                                                                             |
| -------------- | --------------------------------------------------------------------------------------------------------- |
| `id`           | The file name without `.md`. It must match.                                                                |
| `title`        | The question in the words a member would use.                                                              |
| `topic`        | One of `install`, `sources`, `playback`, `library`, `reading`, `accounts`, `tv`, `settings`, `errors`, `updates`, `troubleshooting`. |
| `platform`     | `android`, `android-tv`, `ios` or `any`. Answers that differ per platform get their own entry.            |
| `versions`     | The app versions this was checked against, written as the maintainers write them.                          |
| `keywords`     | Search terms.                                                                                             |
| `questions`    | Other ways a member might ask. Weighted like the title, so they are written the way people ask.             |
| `errorStrings` | The **exact** text of an error this entry explains, separated by `\|`.                                    |
| `sourceUrl`    | Where the answer came from.                                                                                |
| `sourceType`   | `official`, `maintainer` or `community`.                                                                   |
| `checkedAt`    | ISO date the answer was last checked against its source.                                                   |
| `confidence`   | `high`, `medium` or `low`. A community report nobody confirmed is never `high`.                            |
| `outdated`     | True when the source has moved on and the answer may no longer hold.                                       |

The body is the answer itself, in the Markdown subset Discord renders.

---

## How a question is answered

```
message
  └─ mentionReply event
       ├─ was the bot mentioned?            (message.mentions.users + the raw <@id> form)
       ├─ is this a reply to my last answer? (per member, per channel)
       ├─ rate limits: 7 s per member per channel, 20 s per member, 6 answers per channel per minute
       └─ askZangetsu
            ├─ retrieveKnowledge(question)   → the entries that answer it
            ├─ liveSnapshot()                 → the latest release and the guide's state
            ├─ buildKnowledgeBlock(hits)      → the reference material
            ├─ buildReleaseBlock(live)        → what is current
            ├─ shouldUseBrowserSearch?        → live web, only when the question needs it
            └─ Groq (openai/gpt-oss-20b)
```

The model receives the retrieved entries **as data**, inside a marked block, with the instruction that
text inside it is quoted material and never instruction. Retrieved pages, release notes and forum posts are
untrusted input; a page that tells the assistant to ignore its rules is quoting a page.

The answer is then cleaned before it is sent: relationship claims the model made about itself are removed,
mentions the model invented are removed, and any link that was **not** in the retrieved material is replaced
with `[link omitted]`. The only link the app itself ever adds is the owner mention on the romantic-boundary
line, which the app adds and the model never does.

---

## What triggers a live search

A live search is not free, and an ordinary conversation does not need one. It happens when the question
asks about something that changes:

- the latest release, or whether an update exists;
- whether a bug has been fixed;
- whether the app or a site is down right now;
- whether a provider or extension is currently broken or expired;
- the current official installation procedure;
- a newly reported problem;
- or an explicit request to search online.

The stored corpus answers everything else. Asking about which APK to download does not need the web; asking
whether a fix landed in the newest build does.

---

## Keeping it up to date

`refreshZangetsuKnowledge` runs every six hours, and once shortly after the bot starts.

It does three things, each of which can fail without taking the others down:

1. **The release feed.** The upstream repository's releases are read through the same cached GitHub client
   the release announcements use, so the newest version and its notes are known without a second rate-limit
   budget. The feed is cached by ETag, so an unchanged feed costs nothing.
2. **The official guide.** `https://zangetsu.online/guide/` is fetched with a conditional request. When the
   page differs from the copy read last time, `guideChanged` is set and the operator is told to review the
   stored answers — that is the signal that a curated entry has fallen behind.
3. **The freshness stamp.** Every entry records when it was last checked, and the prompt carries the date the
   guide was last read. When the live check cannot be made, the assistant is told that it could not be verified
   rather than being allowed to sound certain.

Nothing is downloaded twice: the guide uses `If-None-Match`, the release feed uses an ETag, and the refresh
itself refuses to run twice inside `minRefreshGapMs`.

### What is never stored

- **No member conversation.** The context of a conversation lives in bot-process memory for twenty minutes and
  is never written to MongoDB. That was true before this work and stays true.
- **No transcript of a fetched page.** Only the release notes and the guide's headings are kept, and only in
  memory.
- **No private community.** Only public pages and public issue trackers are read.

---

## Adding or correcting an entry

1. Edit or add the file in `assets/zangetsu/`. The file name must be the `id` plus `.md`.
2. Fill in `sourceUrl`, `sourceType` and `checkedAt`. An entry without a source is not an entry.
3. Set `confidence` honestly. `community` means somebody reported it; `high` means it was confirmed against
   documentation, the source code, a release note, or reproducible behaviour.
4. Run the tests. `tests/lib/knowledge/` fails on a malformed file, an unknown topic, a missing source, a
   confidence that does not match the source type, and a source that is not a real URL.

If the answer came from a community report that has not been confirmed, keep it, label it `community`, set the
confidence to `low`, and say so in the body. The assistant is told to label community workarounds as such.

---

## The related documents

| Document                                                | What it holds                                                |
| ------------------------------------------------------- | ------------------------------------------------------------ |
| [`zangetsu-faq.md`](zangetsu-faq.md)                     | The questions a member asks most, in plain order.            |
| [`zangetsu-source-index.md`](zangetsu-source-index.md)   | Every source consulted, with what was taken from it.         |
| [`research-summary.md`](research-summary.md)             | What the research found, what it could not verify, and what is still open. |
