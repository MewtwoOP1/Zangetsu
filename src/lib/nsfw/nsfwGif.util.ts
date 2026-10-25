export const NSFW_GIF_CATEGORIES = [
	"gif",
	"random",
	"fuck",
	"anal",
	"blowjob",
	"bj",
	"boobjob",
	"bz",
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

/**
 * Waifu.im's archive uses broad tags rather than every Rule34 action tag.
 * Prefer a relevant tag when possible, then retry against the full NSFW GIF
 * catalogue if that tag has no matching GIFs.
 */
export const CATEGORY_TAGS: Readonly<Record<NsfwGifCategory, readonly string[]>> = {
	gif: [],
	random: [],
	fuck: ["hentai"],
	anal: ["hentai"],
	blowjob: ["oral"],
	bj: ["oral"],
	boobjob: ["paizuri"],
	bz: ["paizuri"],
	tits: ["oppai"],
	ass: ["ass"],
	pussy: ["hentai"],
	cum: ["hentai"],
	handjob: ["oral"],
	hentai: ["hentai"],
	lesbian: ["yuri"],
	threesome: ["hentai"],
};

const ACTION_VERBS: Readonly<Record<NsfwGifCategory, string>> = {
	gif: "shares an adult GIF with",
	random: "shares an adult GIF with",
	fuck: "fucks",
	anal: "has anal sex with",
	blowjob: "gives a blowjob to",
	bj: "gives a blowjob to",
	boobjob: "does a boobjob for",
	bz: "does a boobjob for",
	tits: "shows their breasts to",
	ass: "shows their ass to",
	pussy: "shows their pussy to",
	cum: "cums on",
	handjob: "gives a handjob to",
	hentai: "shares a hentai GIF with",
	lesbian: "has lesbian sex with",
	threesome: "has a threesome with",
};

/** Mention syntax makes the selected users visible as Discord usernames. */
function userMention(userId: string): string {
	return /^\d{17,20}$/.test(userId) ? "<@" + userId + ">" : "@user";
}

/**
 * Discord receives explicit user mention markup, while the command response
 * sets allowedMentions.parse=[] so these mentions do not generate pings.
 */
export function buildNsfwActionLine(
	category: NsfwGifCategory,
	actorUserId: string,
	targetUserId: string,
): string {
	return userMention(actorUserId) + " " + ACTION_VERBS[category] + " " + userMention(targetUserId) + ".";
}

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

const API_BASE = "https://api.waifu-im.workers.dev/";
const API_TIMEOUT_MS = 8_000;

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeTag(value: string): string {
	return value.toLowerCase().replace(/-/g, "_");
}

function getTags(value: Record<string, unknown>): Set<string> {
	const raw = value.tags;
	if (typeof raw === "string") {
		return new Set(raw.split(/\s+/).filter(Boolean).map(normalizeTag));
	}
	if (Array.isArray(raw)) {
		const names = raw.flatMap((tag): string[] => {
			if (typeof tag === "string") return [normalizeTag(tag)];
			if (!isRecord(tag)) return [];
			const name = typeof tag.name === "string" ? tag.name :
				typeof tag.tag === "string" ? tag.tag :
				typeof tag.slug === "string" ? tag.slug : "";
			return name ? [normalizeTag(name)] : [];
		});
		return new Set(names);
	}
	return new Set();
}

function isAllowedWaifuHost(url: URL): boolean {
	const hostname = url.hostname.toLowerCase();
	return hostname === "api.waifu-im.workers.dev" ||
		hostname === "cdn.waifu.im" ||
		hostname.endsWith(".waifu.im");
}

function getGifUrl(value: Record<string, unknown>): string | null {
	const rawUrl = typeof value.url === "string" ? value.url :
		typeof value.file_url === "string" ? value.file_url : "";
	if (!rawUrl) return null;

	try {
		const url = new URL(rawUrl);
		if (url.protocol !== "https:" || !isAllowedWaifuHost(url)) return null;

		const extension = typeof value.extension === "string"
			? value.extension.toLowerCase().replace(/^\./, "")
			: "";
		let searchableUrl = url.href.toLowerCase();
		try {
			searchableUrl = decodeURIComponent(searchableUrl);
		} catch {
			// A malformed escape does not make a URL safe or unsafe by itself.
		}

		if (extension !== "gif" && !/\.gif(?:$|[?#&])/i.test(searchableUrl)) return null;
		return url.toString();
	} catch {
		return null;
	}
}

function getSourceUrl(value: Record<string, unknown>, fileUrl: string): string {
	if (typeof value.source === "string") {
		try {
			const url = new URL(value.source);
			if (url.protocol === "https:") return url.toString();
		} catch {
			// If there is no valid source URL, link directly to the GIF.
		}
	}
	return fileUrl;
}

/** Validates Waifu.im results instead of trusting query filters alone. */
function parseImage(value: unknown): NsfwGifPost | null {
	if (!isRecord(value)) return null;

	const isNsfw = value.is_nsfw === true || value.isNsfw === true;
	if (!isNsfw) return null;

	const tags = getTags(value);
	if (EXCLUDED_TAGS.some((tag) => tags.has(normalizeTag(tag)))) return null;

	const fileUrl = getGifUrl(value);
	if (!fileUrl) return null;

	const rawId = typeof value.id === "number" || typeof value.id === "string"
		? String(value.id)
		: fileUrl;
	return {
		id: rawId,
		fileUrl,
		postUrl: getSourceUrl(value, fileUrl),
	};
}

/** Validate the API response before using any media URL in a Discord embed. */
export function parseWaifuGifImages(payload: unknown): NsfwGifPost[] {
	let images: unknown[] = [];
	if (Array.isArray(payload)) {
		images = payload;
	} else if (isRecord(payload)) {
		if (Array.isArray(payload.images)) images = payload.images;
		else if (Array.isArray(payload.data)) images = payload.data;
		else if (Array.isArray(payload.results)) images = payload.results;
	}
	return images.flatMap((image) => {
		const parsed = parseImage(image);
		return parsed ? [parsed] : [];
	});
}

/** Build a Waifu.im worker search URL. Tags are constants, never user input. */
export function buildWaifuGifSearchUrl(category: NsfwGifCategory, useCategoryTag = true): string {
	const url = new URL("search", API_BASE);
	url.searchParams.set("is_nsfw", "true");
	url.searchParams.set("gif", "true");
	url.searchParams.set("many", "true");
	url.searchParams.set("order_by", "RANDOM");

	if (useCategoryTag) {
		for (const tag of CATEGORY_TAGS[category]) url.searchParams.append("included_tags", tag);
	}
	return url.toString();
}

async function requestWaifuGifSearch(category: NsfwGifCategory, useCategoryTag: boolean): Promise<NsfwGifPost[]> {
	const response = await fetch(buildWaifuGifSearchUrl(category, useCategoryTag), {
		headers: {
			accept: "application/json",
			"user-agent": "ZangetsuDiscordBot/2.0 (+https://zangetsu.online)",
		},
		signal: AbortSignal.timeout(API_TIMEOUT_MS),
	});

	// A tag may not exist on a catalogue mirror; the caller can retry broadly.
	if (!response.ok) {
		if (useCategoryTag && (response.status === 400 || response.status === 404)) return [];
		throw new Error("Waifu.im API request failed with HTTP " + response.status);
	}

	const payload: unknown = await response.json();
	return parseWaifuGifImages(payload);
}

/** Returns a validated NSFW GIF, falling back to the full catalogue for broad tags. */
export async function fetchNsfwGif(category: NsfwGifCategory): Promise<NsfwGifPost | null> {
	let results = await requestWaifuGifSearch(category, true);
	if (results.length === 0 && CATEGORY_TAGS[category].length > 0) {
		results = await requestWaifuGifSearch(category, false);
	}
	if (results.length === 0) return null;
	return results[Math.floor(Math.random() * results.length)] ?? null;
}
