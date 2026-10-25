import { defineCommand } from "@core/command";
import { UserFacingError } from "@core/errors";
import { embed, reply } from "@lib/discord";
import { truncate } from "@lib/format";
import { recommendMedia, type RecommendationType } from "@lib/recommendations";

const MEDIA_TYPES = [
	{ name: "Anime", value: "anime" },
	{ name: "Movie", value: "movie" },
	{ name: "TV series", value: "series" },
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
				"Movie and TV recommendations need the free TMDB API Read Access Token. Add `TMDB_API_READ_ACCESS_TOKEN` to your `.env` file. Anime recommendations work without it.",
			);
		}

		await interaction.deferReply();

		let recommendations;
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

		await reply(interaction, {
			embeds: recommendations.map((item, index) =>
				embed({
					category: "community",
					title: `${index + 1}. ${item.title}`,
					url: item.url,
					description: truncate(item.summary, 700),
					...(item.poster === null ? {} : { thumbnail: item.poster }),
					fields: [
						{
							name: "Rating",
							value: item.rating === null ? "Not rated" : `${item.rating.toFixed(1)}/10`,
							inline: true,
						},
						{ name: "Year", value: item.year === null ? "Unknown" : String(item.year), inline: true },
						{ name: "Genres", value: item.genres.slice(0, 5).join(", ") || "Not listed", inline: true },
					],
					footer:
						item.source === "TMDB"
							? "This product uses the TMDB API but is not endorsed or certified by TMDB."
							: "Source: AniList",
				}),
			),
		});
	},
});
