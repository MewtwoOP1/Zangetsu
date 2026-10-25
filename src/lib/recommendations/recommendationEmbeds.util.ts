import { embed } from "@lib/discord";
import { truncate } from "@lib/format";
import type { MediaRecommendation } from "./recommendations.util";

/** Consistent presentation for command and natural-language recommendation requests. */
export function recommendationEmbeds(items: readonly MediaRecommendation[]) {
	return items.map((item, index) =>
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
	);
}
