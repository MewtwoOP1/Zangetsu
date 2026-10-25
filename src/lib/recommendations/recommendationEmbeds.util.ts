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
				...(item.mediaType === "manga" || item.mediaType === "novel"
					? [
							{
								name: "Chapters",
								value: item.chapters == null ? "Unknown" : new Intl.NumberFormat("en-US").format(item.chapters),
								inline: true,
							},
							{
								name: "Volumes",
								value: item.volumes == null ? "Unknown" : new Intl.NumberFormat("en-US").format(item.volumes),
								inline: true,
							},
						]
					: item.mediaType === "anime"
						? [
								{
									name: "Episodes",
									value: item.episodes == null ? "Unknown" : String(item.episodes),
									inline: true,
								},
							]
						: []),
			],
			footer:
				item.source === "TMDB"
					? "This product uses the TMDB API but is not endorsed or certified by TMDB."
					: "Source: AniList",
		}),
	);
}
