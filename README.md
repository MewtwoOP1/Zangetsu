# Zangetsu

**A community-customized Discord bot, built on Testify v2.**

Zangetsu is our own tailored build of the Testify v2 codebase. We customize its
commands, appearance, music experience, media discovery, and server tools for
our community. This is not an official Testify release.

## Features

- Moderation, server settings, logging, verification, and tickets
- Community tools, welcome features, giveaways, games, and levelling
- YouTube and SoundCloud music search with a live playback panel
- Ranked anime recommendations and movie / TV catalogue lookups
- Economy, leaderboards, and an optional web dashboard
- Slash commands and configurable prefix commands

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

Run `npm run music:setup` if yt-dlp is missing or outdated. Use
`/music status` to inspect the host setup. FFmpeg is required for transcoding,
volume adjustment, and seeking.

Anime uses AniList. Movie and TV lookups use TMDB and require
`TMDB_API_READ_ACCESS_TOKEN`.

## Safety and attribution

Never commit bot tokens, database credentials, or `.env` files. Zangetsu
inherits parts of its foundation from Testify v2; retain the license and
attribution notices when adapting or redistributing the code. See [LICENSE](LICENSE).
