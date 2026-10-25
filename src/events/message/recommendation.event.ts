import { defineMessageHandler } from "@core/message";
import { embed } from "@lib/discord";
import { createMediaSession, recommendMedia, type RecommendationType } from "@lib/recommendations";

const INTENT =
	/\b(?:recommend(?:ation|ations|ed|ing)?|suggest(?:ion|ions|ed|ing)?|what\s+should\s+i\s+(?:watch|read)|what\s+to\s+(?:watch|read)|anything\s+(?:good\s+)?to\s+(?:watch|read)|something\s+(?:good\s+)?to\s+(?:watch|read)|what\s+(?:(?:tv\s+)?(?:series|shows?)|anime|manga|light\s+novels?|novels?|movies?|films?)\s+should\s+i\s+(?:watch|read))\b/i;
const ANIME = /\banime\b/i;
const MANGA = /\b(?:manga|manhwa|manhua|webtoons?|comics?)\b/i;
const NOVEL = /\b(?:light\s*novels?|web\s+novels?|novels?|lns?)\b/i;
const MOVIE = /\bmovies?\b|\bfilms?\b/i;
const SERIES = /\b(?:tv\s+)?series\b|\bshows?\b|\bk-?dramas?\b/i;
const ALL_MEDIA =
	/\b(?:all media|everything|all titles|all formats|anime\s+(?:and|&)\s+(?:manga|light\s+novels?|novels?|movies?|films?|series|shows?)|(?:manga|light\s+novels?|novels?|movies?|films?|series|shows?)\s+(?:and|&)\s+anime|manga\s+(?:and|&)\s+(?:light\s+novels?|novels?|anime)|(?:light\s+novels?|novels?)\s+(?:and|&)\s+manga)\b/i;
const USER_COOLDOWN_MS = 30_000;
const MAX_COOLDOWN_ENTRIES = 2_000;
const PENDING_TYPE_TTL_MS = 90_000;
const cooldowns = new Map<string, number>();
const pendingTypes = new Map<string, { expiresAt: number; preferences: string }>();

export interface RecommendationRequest {
	type: RecommendationType | null;
	preferences: string;
}

/** Removes only this bot's leading Discord mention before interpreting the user's request. */
export function stripBotMention(content: string, botId: string): string {
	return content.replace(new RegExp(`^<@!?${botId}>\\s*`), "").trim();
}

/** Pure intent parsing so natural-language triggers can be tested without Discord. */
export function parseRecommendationRequest(content: string): RecommendationRequest | null {
	const text = content.trim();
	if (!text || text.length > 1_500 || !INTENT.test(text)) return null;

	let type: RecommendationType | null = null;
	if (ALL_MEDIA.test(text)) type = "all";
	else if (ANIME.test(text)) type = "anime";
	else if (MANGA.test(text)) type = "manga";
	else if (NOVEL.test(text)) type = "novel";
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
	if (/^(?:all|all media|everything|all titles)(?: please)?$/.test(text)) return "all";
	if (/^(?:(?:i (?:want|prefer|would like) )?)(?:an? )?anime(?: please)?$/.test(text)) return "anime";
	if (/^(?:(?:i (?:want|prefer|would like) )?)(?:a )?(?:manga|manhwa|manhua|webtoon|comics?)(?: please)?$/.test(text)) return "manga";
	if (/^(?:(?:i (?:want|prefer|would like) )?)(?:a )?(?:light\s*novels?|web\s+novels?|novels?|lns?)(?: please)?$/.test(text)) return "novel";
	if (/^(?:(?:i (?:want|prefer|would like) )?)(?:a )?(?:movies?|films?)(?: please)?$/.test(text)) return "movie";
	if (/^(?:(?:i (?:want|prefer|would like) )?)(?:a )?(?:tv )?(?:series|shows?)(?: please)?$/.test(text)) return "series";
	return null;
}

export default defineMessageHandler({
	name: "mediaRecommendations",
	order: 90,

	async run(message, client) {
		if (!message.channel.isSendable()) return;
		const text = message.content.trim();

		// Explicit type-first prefix commands are handled earlier; allow natural-language requests through.
		const requestText = client.user?.id === undefined ? text : stripBotMention(text, client.user.id);
		const now = Date.now();
		const pending = pendingTypes.get(message.author.id);
		let request = parseRecommendationRequest(requestText);

		if (pending !== undefined) {
			if (pending.expiresAt > now) {
				const choice = parseRecommendationTypeChoice(requestText);
				if (choice !== null) {
					request = { type: choice, preferences: pending.preferences };
					pendingTypes.delete(message.author.id);
				} else if (request?.type === null) {
					return true;
				} else if (request !== null) {
					pendingTypes.delete(message.author.id);
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
						title: "What would you like to watch or read?",
						description: "Choose **anime**, **manga**, **light novel**, **movie**, **TV series**, or **all media**. Add genres, tropes, mood, pacing, or things you want to avoid.",
					}),
				],
				allowedMentions: { parse: [] },
			});
			return true;
		}

		if (cooldownActive(message.author.id, now)) return true;

		if ((request.type === "movie" || request.type === "series") && !client.env.TMDB_API_READ_ACCESS_TOKEN) {
			await message.channel.send({
				embeds: [
					embed({
						category: "community",
						title: "Recommendations are not configured yet",
						description: "Anime, manga, and light novels work without keys. Movie and TV recommendations need the TMDB API Read Access Token. All media still returns reading picks without TMDB.",
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
				openRouterApiKey: client.env.OPENROUTER_API_KEY,
				recommendationAiModel: client.env.RECOMMENDATION_AI_MODEL,
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
				...createMediaSession({
					userId: message.author.id,
					items,
					mode: "recommendation",
				}),
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
