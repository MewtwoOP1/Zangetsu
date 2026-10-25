<p align="center">
  <img alt="Zangetsu community bot icon" src="https://cdn.discordapp.com/icons/1514592000429654196/c07572fcdd3987826f09fdcd490e9b65.webp?size=512" width="128">
</p>

<h1 align="center">Zangetsu</h1>
<p align="center"><strong>Built for our community. Customized our way.</strong></p>
<p align="center">
  <a href="https://discord.js.org"><img alt="discord.js" src="https://img.shields.io/badge/discord.js-v14-5865F2?style=for-the-badge&logo=discord&logoColor=white"></a>
  <a href=".nvmrc"><img alt="Node.js 24.11+" src="https://img.shields.io/badge/Node.js-24.11%2B-339933?style=for-the-badge&logo=node.js&logoColor=white"></a>
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-see%20LICENSE-64748b?style=for-the-badge"></a>
</p>

Zangetsu is our **customized, community-focused Discord bot**, based on the **Testify v2** codebase. We tailor its commands, design, music experience, media discovery, and server tools to fit our own needs. It is a customized build—not an official Testify release.

## What it does

- **Moderation and safety** — server controls, warnings, logging, verification, and tickets.
- **Community tools** — useful information commands, games, giveaways, and welcome features.
- **Music** — YouTube and SoundCloud search, a live queue panel, playback controls, and playlist support.
- **Anime and media discovery** — ranked anime recommendations, movie/TV discovery, catalogue lookups, and app links.
- **Economy and games** — community currency, levelling, casino games, and leaderboards.
- **Customization** — slash commands, prefix commands, configurable features, and an optional web dashboard.

The features and presentation may change as we continue adapting Zangetsu for our community.

## Run locally

**Requirements:** Node.js 24.11 or newer, MongoDB, and a Discord application you control.

```bash
git clone https://github.com/MewtwoOP1/Zangetsu.git
cd Zangetsu
npm ci
npm run setup -- --dev
npm run dev
```

The setup wizard writes `.env.development` for the development bot. For a production instance, use `npm run setup`, then run `npm run build` and `npm start`.

Enable the required Discord Gateway Intents in the Developer Portal. Keep your bot token, database credentials, and all environment values private; never commit `.env` files.

## Music setup

Music normally uses the bundled optional dependencies. If the extractor is missing or outdated, run:

```bash
npm run music:setup
```

Use `/music status` to check the host setup. FFmpeg is needed for transcoding, volume adjustment, and seeking. Music service availability depends on the host and upstream providers.

## Media discovery

- `/lookup recommend` — anime, movies, TV, or a combined ranked selection.
- `/lookup media` — search the catalogues and view ratings and other available stats.

Anime lookup uses AniList. Movie and TV lookup uses TMDB and requires `TMDB_API_READ_ACCESS_TOKEN` in the environment.

## Development

```bash
npm run check
npm run build
```

Zangetsu inherits parts of its foundation from Testify v2. Please retain the repository's license and attribution notices when redistributing or adapting this code; see [LICENSE](LICENSE) for the applicable terms.
