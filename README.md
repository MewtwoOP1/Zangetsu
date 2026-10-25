# Zangetsu

**A community-customized Discord bot, built on Testify v2.**

Zangetsu is our community build, with custom commands, shared branding, moderation, server tools, media discovery, and music.\n\n[Visit zangetsu.online](https://zangetsu.online) · [Download Zangetsu Now](https://zangetsu.online)

## Features

- Moderation, server settings, logging, verification, tickets, permission audits, panic-lock recovery, and Raid Shield alerts\n- Consent-gated, text-only interactions for age-restricted channels
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

## Music and media

`/play query:lofi beats` searches SoundCloud. You can also provide a SoundCloud track or set URL. YouTube and other music sources are not supported by the bot's playback flow.

The bot still uses **yt-dlp** internally to resolve SoundCloud streams. Do not remove the `youtube-dl-exec` package solely because YouTube playback is disabled: it provides the yt-dlp executable used by SoundCloud playback. FFmpeg is needed for transcoding, volume adjustment, and seeking.

Anime uses AniList. Movie and TV lookups use TMDB and require `TMDB_API_READ_ACCESS_TOKEN`.

## Safety and attribution

Never commit bot tokens, database credentials, or `.env` files. Zangetsu inherits parts of its foundation from Testify v2; retain the license and attribution notices when adapting or redistributing the code. See [LICENSE](LICENSE).
