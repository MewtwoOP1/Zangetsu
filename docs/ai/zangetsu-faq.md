# Zangetsu app — FAQ

The questions members ask most, with the answers the assistant gives. It is generated from the same corpus the
assistant searches, so it cannot drift from what the bot says.

Every answer here is checked against the official guide or the upstream repository unless it says otherwise.

---

## Getting started

### Why is the app empty after I install it?

Zangetsu ships with **no sources at all, on purpose**. It is a player, not a library — you choose what to add.
Open **Settings → Sources**, pick an ecosystem, and add a repository. The home screen stays empty until you do.

### Which APK should I download?

Nearly every modern phone wants **arm64-v8a**. If it will not install, use the **universal** build. For Android
TV use the **TV build** — many TV boxes are still 32-bit and the arm64 phone file will crash on them.

### The app will not install, or it closes the moment it opens

Wrong architecture. Install the **universal** build over the top. Your data is kept.

### Is the APK safe?

Yes. The whole app is open source under GPL-3.0 and every release is built and published on
[Spyou/Zangetsu](https://github.com/Spyou/Zangetsu). No ads, no analytics, and no account is needed to watch.
The Android warning about installing outside the Play Store is about the install method, not this app.

### Is there an iPhone version?

Yes — a **beta on TestFlight**. CloudStream and Aniyomi/Mihon extensions do **not** work on iOS, because iOS
does not allow that kind of plugin loading. You get Zangetsu's own sources, the player, downloads and trackers.

### How do I update?

The app checks GitHub Releases and offers the update in-app. There is an opt-in **beta channel** in settings.
Installing a newer APK over the top also works and keeps your data.

---

## Sources

### What is a source?

A small plugin that knows how to search one website and find video for a title.

### What is a repository?

A URL that lists plugins the app can install. Add the repository, install the sources you want from it, and they
appear in the source switcher at the top of the home screen.

### Who runs the repositories?

**Community-run.** The Zangetsu project does not run, host, endorse or control them, and any of them can change
or disappear without notice. Only one of the repositories the official guide points at is the app project's own.

### How do I add a repository?

1. **Settings → Sources**
2. Pick the ecosystem
3. **Add repository**
4. Paste the URL, let it load
5. Install the sources you want

### How do I update my sources?

The same screen. A **badge** appears when an update is available. A source usually gets fixed within days of the
site it reads changing, so updating is the first thing to try when a source that used to work stops.

### Which extension formats work?

Zangetsu's own **JavaScript** sources, **CloudStream** `.cs3`, **Aniyomi/Mihon** (Android packages), and
**LNReader** plugins for light novels. Only Zangetsu's own JavaScript sources work on iOS.

### How do I find out which sources are dead?

**Settings → Sources → Source health.** It tests your installed sources and marks the dead ones. Search puts
healthy sources first, so clearing out dead sources genuinely speeds things up.

---

## Watching

### Nothing plays, or it buffers forever

Usually the source, not the app.

1. Try a different server in the player
2. Try a different source for the same title
3. Run **Source health**
4. Update your sources
5. Raise the buffer under **Settings → Playback**
6. Try an external player from the player menu

### Why does a source find the title but show no playable servers?

The source found the catalogue entry but could not turn it into a stream — usually because the site changed.
Update the source, or use another one. It is a source problem, not an app problem.

### What is a Cloudflare challenge?

Some sites sit behind a "checking your browser" screen. The app opens a real browser view so the check can
complete. Do it once and the result is remembered. If it happens every single time, it is a bad source.

### Why does a browser window open when I press play?

Either a Cloudflare check or an ad page. Both are the **source's** behaviour, not the app's.

### How do I fix missing subtitles?

Subtitle tracks depend on the source. Try another server for the same episode, then another source. If the
track exists but is late, the timing comes from the source's file.

### Can I watch downloaded episodes offline?

Yes. Tap the download icon on an episode, or use the batch button on the episode list. Streams that arrive in
pieces are stitched into a single playable file, so downloads behave like ordinary videos, including seeking.
The folder is chosen in settings.

---

## On your TV

### Does Zangetsu support Android TV?

Yes. Install the **TV build** from the releases page. The app detects the TV and switches to a D-pad interface
automatically.

### How do I sign in on a TV without typing?

**Settings → Connections → Connect**, then scan a QR code. With Zangetsu on your phone, scanning opens the app
and you approve; without it, any phone camera opens a web page where you sign in. The same flow connects AniList,
MyAnimeList and Simkl.

### How do I get around with the remote?

Arrow keys to move, **OK** to select, **Back** to go up. Holding **OK** on a poster opens its quick menu.

---

## Accounts

### Do I need an account to watch?

No. Watching needs no sign-in. A Zangetsu account is optional and only exists to sync your list across devices.

### How do I connect AniList?

**Settings → Connections → Connect**, then pick the tracker and approve it. Progress then syncs to it alongside
your own list. On a TV, use the QR flow instead.

### What does Incognito mode do?

It pauses watch history, external scrobbling, and Discord presence.

---

## When something is wrong

### Is this the app's fault or the source's?

Almost always the source. Sites break, move domain, add bot protection or go down, and a source written for last
month's layout stops working.

- One title, one source → that title or that source
- One title, every source → that title's catalogue entry
- Every title, one source → that source
- Every title, every source, one device → the app, the device or the network
- Every title, every source, every device → worth reporting as an app bug

### How do I report a bug?

Send the app version, the device and its Android version, the source or extension ecosystem involved, the exact
error message, how to reproduce it, whether one title or all of them are affected, and whether it started after an
update. Run **Source health** and try another source first — most reports turn out to be a third-party provider,
and those go to the source's author.

### Is there a known fix for my problem?

Check the release notes on the upstream repository's releases page. Fixes are named there. If your symptom is not
in any release, it is probably not fixed yet, and the honest answer is that it is not confirmed fixed.
