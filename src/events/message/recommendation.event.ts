import { defineMessageHandler } from "@core/message";
import { embed } from "@lib/discord";
import { recommendMedia, recommendationEmbeds, type RecommendationType } from "@lib/recommendations";

const INTENT =
	/\b(?:recommend(?:ation|ations|ed|ing)?|suggest(?:ion|ions|ed|ing)?|what\s+should\s+i\s+watch|what\s+to\s+watch|anything\s+(?:good\s+)?to\s+watch|something\s+(?:good\s+)?to\s+watch|what\s+(?:(?:tv\s+)?(?:series|shows?)|anime|movies?|films?)\s+should\s+i\s+watch)\b/i;
const ANIME = /\banime\b/i;
const MOVIE = /\bmovies?\b|\bfilms?\b/i;
const SERIES = /\b(?:tv\s+)?series\b|\bshows?\b|\bk-?dramas?\b/i;
const USER_COOLDOWN_MS = 30_000;
const MAX_COOLDOWN_ENTRIES = 2_000;
const PENDING_TYPE_TTL_MS = 90_000;
const cooldowns = new Map<string, number>();
const pendingTypes = new Map<string, { expiresAt: number; preferences: string }>();

export interface RecommendationRequest {
	type: RecommendationType | null;
	preferences: string;
}

/** Pure intent parsing so natural-language triggers can be tested without Discord. */
export function parseRecommendationRequest(content: string): RecommendationRequest | null {
	const text = content.trim();
	if (!text || text.length > 1_500 || !INTENT.test(text)) return null;

	let type: RecommendationType | null = null;
	if (ANIME.test(text)) type = "anime";
	else if (MOVIE.test(text)) type = "movie";
	else if (SERIES.test(text)) type = "series";

	return { type, preferences: text.slice(0, 250) };
}

function cooldownActive(userId: string, now: number): boolean {
	const expiresAt = cooldowns.get(userId);
	if (expiresAt !== undefined && expiresAt > now) return true;

	cooldowns.delete(userId);
	if (cooldowns.size >= MAX_COOLDOWN_ENTRIES) {
		const first = cooldowns.keys().next().value;
		if (first !== undefined) cooldowns.delete(first);
	}
	cooldowns.set(userId, now + USER_COOLDOWN_MS);
	return false;
}

export function clearRecommendationCooldowns(): void {
	cooldowns.clear();
	pendingTypes.clear();
}

/** Accept a short answer to the type prompt, e.g. "anime", "movie", or "series". */
export function parseRecommendationTypeChoice(content: string): RecommendationType | null {
	const text = content.trim().toLowerCase().replace(/[.!?]+$/, "").trim();
	if (text === "anime") return "anime";
	if (text === "movie" || text === "movies" || text === "film" || text === "films") return "movie";
	if (text === "series" || text === "tv series" || text === "show" || text === "shows" || text === "tv show" || text === "tv shows") return "series";
	return null;
}

export default defineMessageHandler({
	name: "mediaRecommendations",
	order: 90,

	async run(message, client) {
		if (!message.guild || !message.channel.isSendable()) return;
		const text = message.content.trim();

		// Prefix commands already invoke the same recommendation service. Never answer them twice.
		if (/^t\?/i.test(text) || /^<@!?\d+>/.test(text)) return;

		const now = Date.now();
		const pending = pendingTypes.get(message.author.id);
		let request = parseRecommendationRequest(text);

		if (pending !== undefined) {
			if (pending.expiresAt > now) {
				const choice = parseRecommendationTypeChoice(text);
				if (choice !== null) {
					request = { type: choice, preferences: pending.preferences };
					pendingTypes.delete(message.author.id);
				} else if (request?.type === null) {
					return true;
				}
			} else {
				pendingTypes.delete(message.author.id);
			}
		}

		if (request === null) return;

		if (request.type === null) {
			if (pendingTypes.size >= MAX_COOLDOWN_ENTRIES) {
				const first = pendingTypes.keys().next().value;
				if (first !== undefined) pendingTypes.delete(first);
			}
			pendingTypes.set(message.author.id, {
				expiresAt: now + PENDING_TYPE_TTL_MS,
				preferences: request.preferences,
			});
			await message.channel.send({
				embeds: [
					embed({
						category: "community",
						title: "What would you like to watch?",
						description: "Tell me which type you want: **anime**, **movie**, or **TV series**, and any genre or trope you like.",
					}),
				],
				allowedMentions: { parse: [] },
			});
			return true;
		}

		if (cooldownActive(message.author.id, now)) return true;

		if (request.type !== "anime" && !client.env.TMDB_API_READ_ACCESS_TOKEN) {
			await message.channel.send({
				embeds: [
					embed({
						category: "community",
						title: "Recommendations are not configured yet",
						description: "Anime recommendations are available now. Movie and TV recommendations need the optional TMDB API Read Access Token.",
					}),
				],
				allowedMentions: { parse: [] },
			});
			return true;
		}

		try {
			const items = await recommendMedia({
				type: request.type,
				preferences: request.preferences,
				tmdbToken: client.env.TMDB_API_READ_ACCESS_TOKEN,
			});
			if (items.length === 0) {
				await message.channel.send({
					embeds: [
						embed({
							category: "community",
							title: "No matches found",
							description: "I couldn't find suitable titles for that request. Try a different genre or a broader description.",
						}),
					],
					allowedMentions: { parse: [] },
				});
				return true;
			}

			await message.channel.send({
				embeds: recommendationEmbeds(items),
				allowedMentions: { parse: [] },
			});
		} catch (error) {
			client.logger.warn({ err: error, type: request.type }, "Natural-language media recommendation failed");
			await message.channel.send({
				embeds: [
					embed({
						category: "community",
						title: "Recommendations are temporarily unavailable",
						description: "Please try again in a little while.",
					}),
				],
				allowedMentions: { parse: [] },
			});
		}

		return true;
	},
});
