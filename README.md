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
- Groq-powered Zangetsu AI chat when members mention the bot, with short-lived conversation context and official app knowledge; the same Groq integration also powers natural-language media recommendations
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

The `/releases` command posts new public GitHub releases as plain-text Discord messages, not embeds. The Spyou/Zangetsu announcement uses the official release layout with the version, publication date, grouped release highlights, available APK download links, and the official footer. Run `/releases setup` to choose the announcement channel and optional role to ping; setup automatically tracks [`Spyou/Zangetsu`](https://github.com/Spyou/Zangetsu). Use `/releases add repository:owner/repo` to track additional public repositories. `/releases list` shows the configuration, and `/releases remove` stops tracking a repository. Use `/releases check` to force an immediate fresh check for this server; it announces only releases newer than the saved cursor, without waiting for the scheduled check. Use `/releases test channel:#channel` to send a preview of the latest app release to a chosen channel. The channel is optional: without it, the bot uses the configured channel, or the current channel if release announcements have not been configured. The prefix alias `release` is also supported, so the configured prefix can be used with `release test #channel`.

The bot checks tracked repositories every 10 minutes. A token is optional, but on shared hosting such as Render, set `GITHUB_TOKEN` in the service's environment variables to avoid the unauthenticated API's 60-requests-per-hour-per-IP limit. Authenticated requests generally have a 5,000-requests-per-hour limit. Use a fine-grained token with read-only access to public repository contents; never paste it into source code or commit it. The bot sends it only as an HTTP authorization header and does not log it. Only published releases from public repositories are supported. When a repository is first tracked, its current latest release is saved as the starting point so old releases are not announced retroactively. Role notifications explicitly allow only the configured role, and the `@everyone` role is rejected.

The feature requires MongoDB (already used by Zangetsu) and the bot needs View Channel and Send Messages in the configured announcement channel. The command requires Manage Server permission.

## Zangetsu AI

Mention the bot with a message such as `@Zangetsu hi, what are you doing?` to chat, then reply to its answer to continue. Zangetsu uses the same cute, witty, teasing, sarcastic girlfriend persona with everyone, but its one boyfriend is the first ID in `DISCORD_OWNER_IDS`. It does **not** mention or tag the owner in normal replies, greetings, jokes, help, technical answers, or harmless compliments. Only a clear romantic advance from another member (for example, “I love you,” “date me,” “are you single?” or “make my heart skip a beat”) triggers one playful taken-status line with the real owner mention. The model's accidental owner claims are stripped to prevent duplicate mentions; ordinary replies stay natural. Replies target 2–4 sentences (about 35–70 words), becoming sincere for serious topics. It reuses `GROQ_API_KEY` and `RECOMMENDATION_AI_MODEL`; no extra provider, key, or environment variable is needed. To reduce Groq input tokens, product notes are sent only for Zangetsu app questions, with up to four recent messages (600 characters each); questions are capped at 1,000 characters and completions at 320 tokens. Context stays in process memory for 20 minutes and is not saved to MongoDB. If Groq is not configured, normal help remains available.

## Music and media

`/play query:lofi beats` searches SoundCloud. You can also provide a SoundCloud track or set URL. YouTube and other music sources are not supported by the bot's playback flow.

The bot still uses **yt-dlp** internally to resolve SoundCloud streams. Do not remove the `youtube-dl-exec` package solely because YouTube playback is disabled: it provides the yt-dlp executable used by SoundCloud playback. FFmpeg is needed for transcoding, volume adjustment, and seeking.

Anime, manga, and light novels use AniList and need no catalogue API key. Movie and TV lookups use TMDB and require `TMDB_API_READ_ACCESS_TOKEN`. For semantic AI-ranked recommendations, set `GROQ_API_KEY` from [GroqCloud](https://console.groq.com/keys); the default model is `openai/gpt-oss-20b`. Messages beginning with `suggest` or `recommend` accept free-form prompts such as “suggest me an MC with no emotions who becomes a demon lord.” The bot detects explicit media types and defaults to anime when no format is named. Use `/lookup anime query:Bleach` for a detailed anime lookup, including synopsis, genres, rating, year, format, status, episodes, runtime, AniList ranking, popularity, and favorites; results link into Zangetsu. OpenRouter remains a legacy fallback through `OPENROUTER_API_KEY`. AI only reorders actual AniList/TMDB catalogue candidates; if AI is unavailable or rate-limited, local preference/tag ranking is used.

## Safety and attribution

Never commit bot tokens, database credentials, or `.env` files. Zangetsu inherits parts of its foundation from Testify v2; retain the license and attribution notices when adapting or redistributing the code. See [LICENSE](LICENSE).
