# Zangetsu

**A community-customized Discord bot, built on Testify v2.**

Zangetsu is our community build, with custom commands, shared branding, moderation, server tools, media discovery, and music.

[Visit zangetsu.online](https://zangetsu.online) · [Download Zangetsu Now](https://zangetsu.online)

## Features

- Moderation, server settings, logging, verification, tickets, permission audits, panic-lock recovery, and Raid Shield alerts
- Adult hentai GIF retrieval in age-restricted channels
- Community tools, welcome features, giveaways, games, and levelling
- SoundCloud-only music search and playback with `/play` title search
- Anime recommendations and movie / TV catalogue lookups
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

The `/nsfw` module is disabled by default. A server manager can enable or disable it with `/nsfw enable` and `/nsfw disable`. GIF commands only run in Discord age-restricted channels and do not target or mention other members; no per-user consent settings are used. Categories include `/nsfw gif`, `/nsfw fuck`, `/nsfw anal`, `/nsfw blowjob`, `/nsfw tits`, `/nsfw ass`, `/nsfw pussy`, `/nsfw cum`, `/nsfw handjob`, `/nsfw hentai`, `/nsfw lesbian`, `/nsfw threesome`, and `/nsfw random`. The provider is Rule34's documented post API; the bot requests explicit animated posts, accepts GIF files only, rejects common underage and abusive tags, and validates HTTPS media URLs before displaying results. Third-party ratings and tags are not infallible.

## Music and media

`/play query:lofi beats` searches SoundCloud. You can also provide a SoundCloud track or set URL. YouTube and other music sources are not supported by the bot's playback flow.

The bot still uses **yt-dlp** internally to resolve SoundCloud streams. Do not remove the `youtube-dl-exec` package solely because YouTube playback is disabled: it provides the yt-dlp executable used by SoundCloud playback. FFmpeg is needed for transcoding, volume adjustment, and seeking.

Anime uses AniList. Movie and TV lookups use TMDB and require `TMDB_API_READ_ACCESS_TOKEN`.

## Safety and attribution

Never commit bot tokens, database credentials, or `.env` files. Zangetsu inherits parts of its foundation from Testify v2; retain the license and attribution notices when adapting or redistributing the code. See [LICENSE](LICENSE).
