# Zangetsu

**A community-customized Discord bot, built on Testify v2.**

Zangetsu is our community build, with custom commands, shared branding, moderation, server tools, media discovery, and music.

[Visit zangetsu.online](https://zangetsu.online) · [Download Zangetsu Now](https://zangetsu.online)

## Features

- Moderation, server settings, logging, verification, tickets, permission audits, panic-lock recovery, and Raid Shield alerts
- Adult hentai GIF retrieval in age-restricted channels
- Community tools, welcome features, giveaways, games, and levelling
- SoundCloud-only music search and playback with `/play` title search
- Anime title lookup with synopsis, genres, rating, format, status, episode count, runtime, AniList ranking, popularity, and favorites, plus preference-aware recommendations for anime, manga, light novels, and optional TMDB movies / TV
- Optional Groq AI reranking for free-form natural-language recommendations; OpenRouter remains supported as a legacy fallback
- Economy, leaderboards, and an optional web dashboard
- Slash commands and configurable prefix commands
- Shared Zangetsu logo on command embeds and help responses

## Local development

Requirements: Node.js 24.11+, MongoDB, and a Discord application you control.

```bash
git clone https://github.com/MewtwoOP1/Zangetsu.git
cd Zangetsu
npm ci
npm run setup -- --dev
npm run dev
```

For production, run `npm run setup`, then `npm run build` and `npm start`.

## Security commands

- `/security admin-check` lists roles with Administrator access.
- `/security audit-webhooks` inventories webhook names and locations without exposing tokens.
- `/security export-channel` creates a private CSV/JSON export of up to 100 recent messages. Use the slash command so the export stays ephemeral; both you and the bot must be able to read the channel.
- `/security panic` temporarily locks the current channel; `/security restore` restores the saved message permission overrides.
- `/security raid-shield-enable` and `/security raid-shield-disable` toggle join-burst alerts. Raid Shield alerts only; it does not automatically punish members.

## Adult hentai GIFs

The `/nsfw` module is disabled by default. A server manager can enable or disable it with `/nsfw enable` and `/nsfw disable`. GIF commands only run in Discord age-restricted channels. Categories include `/nsfw gif`, `/nsfw fuck`, `/nsfw anal`, `/nsfw blowjob`, `/nsfw tits`, `/nsfw ass`, `/nsfw pussy`, `/nsfw cum`, `/nsfw handjob`, `/nsfw hentai`, `/nsfw lesbian`, `/nsfw threesome`, and `/nsfw random`. Each category accepts an optional `target` member. The response shows the selected users as Discord mentions without triggering notification pings. The provider is the Waifu.im Workers API at `https://api.waifu-im.workers.dev/`; no provider credentials are required. Requests ask for NSFW GIFs and exclude common underage and abusive tags. The provider's tags and content ratings are not infallible.

## GitHub release announcements

The `/releases` command posts new public GitHub releases as plain-text Discord messages, not embeds. The Spyou/Zangetsu announcement uses the official release layout with the version, publication date, grouped release highlights, available APK download links, and the official footer. Run `/releases setup` to choose the announcement channel and optional role to ping; setup automatically tracks [`Spyou/Zangetsu`](https://github.com/Spyou/Zangetsu). Use `/releases add repository:owner/repo` to track additional public repositories. `/releases list` shows the configuration, `/releases remove` stops tracking a repository, and `/releases test` fetches the latest app release and previews the same plain-text format.

The bot checks tracked repositories every 10 minutes. A token is optional, but on shared hosting such as Render, set `GITHUB_TOKEN` in the service's environment variables to avoid the unauthenticated API's 60-requests-per-hour-per-IP limit. Authenticated requests generally have a 5,000-requests-per-hour limit. Use a fine-grained token with read-only access to public repository contents; never paste it into source code or commit it. The bot sends it only as an HTTP authorization header and does not log it. Only published releases from public repositories are supported. When a repository is first tracked, its current latest release is saved as the starting point so old releases are not announced retroactively. Role notifications explicitly allow only the configured role, and the `@everyone` role is rejected.

The feature requires MongoDB (already used by Zangetsu) and the bot needs View Channel and Send Messages in the configured announcement channel. The command requires Manage Server permission.

## Music and media

`/play query:lofi beats` searches SoundCloud. You can also provide a SoundCloud track or set URL. YouTube and other music sources are not supported by the bot's playback flow.

The bot still uses **yt-dlp** internally to resolve SoundCloud streams. Do not remove the `youtube-dl-exec` package solely because YouTube playback is disabled: it provides the yt-dlp executable used by SoundCloud playback. FFmpeg is needed for transcoding, volume adjustment, and seeking.

Anime, manga, and light novels use AniList and need no catalogue API key. Movie and TV lookups use TMDB and require `TMDB_API_READ_ACCESS_TOKEN`. For semantic AI-ranked recommendations, set `GROQ_API_KEY` from [GroqCloud](https://console.groq.com/keys); the default model is `openai/gpt-oss-20b`. Messages beginning with `suggest` or `recommend` accept free-form prompts such as “suggest me an MC with no emotions who becomes a demon lord.” The bot detects explicit media types and defaults to anime when no format is named. Use `/lookup anime query:Bleach` for a detailed anime lookup, including synopsis, genres, rating, year, format, status, episodes, runtime, AniList ranking, popularity, and favorites; results link into Zangetsu. OpenRouter remains a legacy fallback through `OPENROUTER_API_KEY`. AI only reorders actual AniList/TMDB catalogue candidates; if AI is unavailable or rate-limited, local preference/tag ranking is used.

## Safety and attribution

Never commit bot tokens, database credentials, or `.env` files. Zangetsu inherits parts of its foundation from Testify v2; retain the license and attribution notices when adapting or redistributing the code. See [LICENSE](LICENSE).
