import { defineCommand } from "@core/command";
import { UserFacingError } from "@core/errors";
import { reply } from "@lib/discord";
import { createMediaSession, lookupMedia, type MediaLookupType } from "@lib/recommendations";

const MEDIA_TYPES = [
	{ name: "All media", value: "all" },
	{ name: "Anime", value: "anime" },
	{ name: "Manga / Manhwa / Manhua", value: "manga" },
	{ name: "Light novel", value: "novel" },
	{ name: "Movie", value: "movie" },
	{ name: "TV series", value: "series" },
];

export default defineCommand({
	name: "media",
	description: "Search anime, manga, light novels, movies, and TV series with catalogue stats.",
	category: "community",
	cooldown: 5_000,
	options: [
		{
			name: "query",
			description: "The title to search for across the selected catalogue.",
			type: "string",
			required: true,
			maxLength: 100,
		},
		{
			name: "type",
			description: "Choose one catalogue or search every source.",
			type: "string",
			choices: MEDIA_TYPES,
		},
	],

	async run(interaction, client) {
		const query = interaction.options.getString("query", true).trim();
		const type = (interaction.options.getString("type") ?? "all") as MediaLookupType;

		if (!query) throw new UserFacingError("Enter a title to search for.");
		if ((type === "movie" || type === "series") && !client.env.TMDB_API_READ_ACCESS_TOKEN) {
			throw new UserFacingError(
				"Movie and TV lookups need the free TMDB API Read Access Token. Add `TMDB_API_READ_ACCESS_TOKEN` to your environment, or choose **Anime**, **Manga**, **Light novel**, or **All media** to search AniList.",
			);
		}

		await interaction.deferReply();

		let results: Awaited<ReturnType<typeof lookupMedia>>;
		try {
			results = await lookupMedia({
				query,
				type,
				tmdbToken: client.env.TMDB_API_READ_ACCESS_TOKEN,
			});
		} catch (error) {
			client.logger.warn({ err: error, type, query }, "Media lookup failed");
			throw new UserFacingError("I couldn't search the media catalogues right now. Please try again shortly.");
		}

		if (results.length === 0) {
			throw new UserFacingError(
				`No catalogue matches found for **${query}**. Try the original title or a shorter search.`,
			);
		}

		await reply(
			interaction,
			createMediaSession({
				userId: interaction.user.id,
				items: results,
				mode: "lookup",
				query,
			}),
		);
	},
});
