import { loadEnv } from "@config/env";

export const NSFW_GIF_CATEGORIES = [
	"gif",
	"random",
	"fuck",
	"anal",
	"blowjob",
	"tits",
	"ass",
	"pussy",
	"cum",
	"handjob",
	"hentai",
	"lesbian",
	"threesome",
] as const;

export type NsfwGifCategory = (typeof NSFW_GIF_CATEGORIES)[number];

export interface NsfwGifPost {
	id: string;
	fileUrl: string;
	postUrl: string;
}

const CATEGORY_TAGS: Record<NsfwGifCategory, string[]> = {
	gif: [],
	random: [],
	fuck: ["sex"],
	anal: ["anal"],
	blowjob: ["blowjob"],
	tits: ["breasts"],
	ass: ["ass"],
	pussy: ["pussy"],
	cum: ["cum"],
	handjob: ["handjob"],
	hentai: [],
	lesbian: ["yuri"],
	threesome: ["threesome"],
};

const EXCLUDED_TAGS = [
	"loli",
	"lolicon",
	"shota",
	"shotacon",
	"underage",
	"child",
	"toddler",
	"young",
	"teen",
	"age_regression",
	"aged_down",
	"rape",
	"forced",
	"nonconsensual",
	"incest",
	"bestiality",
] as const;

const API_ENDPOINT = "https://api.rule34.xxx/index.php";

export interface Rule34ApiCredentials {
	apiKey: string;
	userId: string;
}

export class NsfwGifConfigurationError extends Error {
	constructor() {
		super(
			"Hentai GIF search is not configured. Set RULE34_API_KEY and RULE34_USER_ID in the bot host environment.",
		);
		this.name = "NsfwGifConfigurationError";
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isRule34GifUrl(value: unknown): value is string {
	if (typeof value !== "string") return false;

	try {
		const url = new URL(value);
		return (
			url.protocol === "https:" &&
			(url.hostname === "rule34.xxx" || url.hostname.endsWith(".rule34.xxx")) &&
			url.pathname.toLowerCase().endsWith(".gif")
		);
	} catch {
		return false;
	}
}

function parsePost(value: unknown, category: NsfwGifCategory): NsfwGifPost | null {
	if (!isRecord(value)) return null;

	const id = typeof value.id === "number" || typeof value.id === "string" ? String(value.id) : "";
	const tagsText = typeof value.tags === "string" ? value.tags.toLowerCase() : "";
	const tags = new Set(tagsText.split(/\s+/).filter(Boolean));
	const rating = typeof value.rating === "string" ? value.rating.toLowerCase() : "";

	if (!/^\d+$/.test(id)) return null;
	if (rating !== "explicit" && rating !== "e") return null;
	if (!tags.has("animated")) return null;
	if (!CATEGORY_TAGS[category].every((tag) => tags.has(tag))) return null;
	if (EXCLUDED_TAGS.some((tag) => tags.has(tag))) return null;
	if (!isRule34GifUrl(value.file_url)) return null;

	return {
		id,
		fileUrl: value.file_url,
		postUrl: `https://rule34.xxx/index.php?page=post&s=view&id=${id}`,
	};
}

/** Validates untrusted API data before a media URL can be sent to Discord. */
export function parseRule34GifPosts(payload: unknown, category: NsfwGifCategory): NsfwGifPost[] {
	if (!Array.isArray(payload)) return [];
	return payload.flatMap((post) => {
		const parsed = parsePost(post, category);
		return parsed ? [parsed] : [];
	});
}

/** Builds the documented Rule34 DAPI search URL without accepting arbitrary user-supplied tags. */
export function buildRule34GifSearchUrl(
	category: NsfwGifCategory,
	credentials?: Rule34ApiCredentials,
): string {
	const url = new URL(API_ENDPOINT);
	const tags = [
		...CATEGORY_TAGS[category],
		"rating:explicit",
		"animated",
		"sort:random",
		"-video",
		"-webm",
		"-mp4",
		...EXCLUDED_TAGS.map((tag) => `-${tag}`),
	];

	url.searchParams.set("page", "dapi");
	url.searchParams.set("s", "post");
	url.searchParams.set("q", "index");
	url.searchParams.set("json", "1");
	url.searchParams.set("limit", "100");
	url.searchParams.set("tags", tags.join(" "));
	if (credentials) {
		url.searchParams.set("api_key", credentials.apiKey);
		url.searchParams.set("user_id", credentials.userId);
	}
	return url.toString();
}

/** Requests one randomized page and returns a validated animated GIF, or null if none matched. */
export async function fetchNsfwGif(category: NsfwGifCategory): Promise<NsfwGifPost | null> {
	const env = loadEnv();
	const apiKey = env.RULE34_API_KEY;
	const userId = env.RULE34_USER_ID;
	if (!apiKey || !userId) throw new NsfwGifConfigurationError();

	const response = await fetch(buildRule34GifSearchUrl(category, { apiKey, userId }), {
		headers: {
			accept: "application/json",
			"user-agent": "ZangetsuDiscordBot/2.0 (+https://zangetsu.online)",
		},
		signal: AbortSignal.timeout(8_000),
	});

	if (!response.ok) throw new Error(`Rule34 API request failed with HTTP ${response.status}`);

	const payload: unknown = await response.json();
	const results = parseRule34GifPosts(payload, category);
	if (results.length === 0) return null;

	return results[Math.floor(Math.random() * results.length)] ?? null;
}
