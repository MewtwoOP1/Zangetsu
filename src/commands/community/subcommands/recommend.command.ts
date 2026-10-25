import { defineCommand } from "@core/command";
import { UserFacingError } from "@core/errors";
import { reply } from "@lib/discord";
import { createMediaSession, recommendMedia, type RecommendationType } from "@lib/recommendations";

const MEDIA_TYPES = [
	{ name: "Anime", value: "anime" },
	{ name: "Movie", value: "movie" },
	{ name: "TV series", value: "series" },
	{ name: "All media · top AniList + TMDB picks", value: "all" },
];

export default defineCommand({
	name: "recommend",
	description: "Recommends anime, movies, or TV series.",
	category: "community",
	aliases: ["rec"],
	cooldown: 15_000,
	options: [
		{
			name: "type",
			description: "What kind of media should I recommend?",
			type: "string",
			required: true,
			choices: MEDIA_TYPES,
		},
		{
			name: "preferences",
			description: "Optional genres, mood, or anime tropes, such as fantasy romance or OP MC.",
			type: "string",
			maxLength: 250,
		},
	],

	async run(interaction, client) {
		const type = interaction.options.getString("type", true) as RecommendationType;
		const preferences = interaction.options.getString("preferences") ?? "";

		if (type !== "anime" && !client.env.TMDB_API_READ_ACCESS_TOKEN) {
			throw new UserFacingError(
				"Movie, TV, and all-media recommendations need the TMDB API Read Access Token. Anime recommendations work without it.",
			);
		}

		await interaction.deferReply();

		let recommendations: Awaited<ReturnType<typeof recommendMedia>>;
		try {
			recommendations = await recommendMedia({
				type,
				preferences,
				tmdbToken: client.env.TMDB_API_READ_ACCESS_TOKEN,
			});
		} catch (error) {
			client.logger.warn({ err: error, type }, "Media recommendation request failed");
			throw new UserFacingError("I couldn't fetch recommendations right now. Please try again shortly.");
		}

		if (recommendations.length === 0) {
			throw new UserFacingError("I couldn't find matching titles. Try a broader genre or different preferences.");
		}

		await reply(interaction, createMediaSession({
			userId: interaction.user.id,
			items: recommendations,
			mode: "recommendation",
		}));
	},
});
