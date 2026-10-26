import { defineCommand } from "@core/command";
import { UserFacingError } from "@core/errors";
import { reply } from "@lib/discord";
import { createMediaSession, lookupMedia } from "@lib/recommendations";

/** Dedicated AniList title search with the complete catalogue details shown immediately. */
export default defineCommand({
	name: "anime",
	description: "Looks up an anime with synopsis, genres, rating, format, status, and stats.",
	category: "community",
	cooldown: 5_000,
	options: [
		{
			name: "query",
			description: "The anime title to look up.",
			type: "string",
			required: true,
			maxLength: 100,
		},
	],

	async run(interaction, client) {
		const query = interaction.options.getString("query", true).trim();
		if (!query) throw new UserFacingError("Enter an anime title to look up.");

		await interaction.deferReply();

		let results: Awaited<ReturnType<typeof lookupMedia>>;
		try {
			results = await lookupMedia({ query, type: "anime" });
		} catch (error) {
			client.logger.warn({ err: error, query }, "Anime lookup failed");
			throw new UserFacingError("I couldn't search AniList right now. Please try again shortly.");
		}

		if (results.length === 0) {
			throw new UserFacingError(
				`No anime found for **${query}**. Try the English title, Japanese title, or a shorter search.`,
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
