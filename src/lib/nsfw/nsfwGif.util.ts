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
 * Waifu.im's archive uses broad tags rather than a separate tag for every action.
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

const PRIMARY_API_BASE = "https://waifu-api-031n.onrender.com/";
const INSTANCE_INDEX_URL = new URL("instances", PRIMARY_API_BASE).toString();
const DEFAULT_API_BASES = [
	PRIMARY_API_BASE,
	"https://api.marek-server.com/",
	"https://waifu.best/",
] as const;
const API_TIMEOUT_MS = 2_500;
const INSTANCE_INDEX_TIMEOUT_MS = 1_500;
const INSTANCE_CACHE_TTL_MS = 5 * 60_000;
const MAX_API_BASES = 4;

let cachedApiBases: string[] = [...DEFAULT_API_BASES];
let cachedApiBasesUntil = 0;
let apiBaseDiscovery: Promise<string[]> | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Normalize an HTTPS API origin while rejecting URL credentials and local hosts. */
function normalizeApiBase(value: string): string | null {
	try {
		const url = new URL(value);
		const hostname = url.hostname.toLowerCase();
		if (
			url.protocol !== "https:" ||
			url.username ||
			url.password ||
			url.search ||
			url.hash ||
			!hostname ||
			hostname === "localhost" ||
			hostname.endsWith(".localhost") ||
			hostname.endsWith(".local") ||
			hostname.endsWith(".internal") ||
			hostname.startsWith("[") ||
			/^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)
		) {
			return null;
		}

		url.pathname = url.pathname.endsWith("/") ? url.pathname : url.pathname + "/";
		return url.toString();
	} catch {
		return null;
	}
}

/** Read the fork's public instance index; registered URLs are validated before use. */
async function discoverApiBases(): Promise<string[]> {
	let candidates: string[] = [...DEFAULT_API_BASES];

	try {
		const response = await fetch(INSTANCE_INDEX_URL, {
			headers: {
				accept: "application/json",
				"user-agent": "ZangetsuDiscordBot/2.0 (+https://zangetsu.online)",
			},
			signal: AbortSignal.timeout(INSTANCE_INDEX_TIMEOUT_MS),
		});
		const contentType = response.headers.get("content-type") ?? "";
		if (response.ok && contentType.toLowerCase().includes("json")) {
			const payload: unknown = await response.json();
			if (isRecord(payload) && Array.isArray(payload.instances)) {
				const listedBases = payload.instances.flatMap((entry): string[] => {
					if (
						!isRecord(entry) ||
						typeof entry.url !== "string" ||
						entry.schema === false ||
						entry.images === false
					) {
						return [];
					}
					const base = normalizeApiBase(entry.url);
					return base ? [base] : [];
				});
				candidates = [PRIMARY_API_BASE, ...listedBases, ...DEFAULT_API_BASES.slice(1)];
			}
		}
	} catch {
		// The index can be asleep or unavailable; use the known fallback bases.
	}

	cachedApiBases = [
		...new Set(candidates.map((base) => normalizeApiBase(base)).filter((base): base is string => base !== null)),
	].slice(0, MAX_API_BASES);
	cachedApiBasesUntil = Date.now() + INSTANCE_CACHE_TTL_MS;
	return cachedApiBases;
}

async function getApiBases(): Promise<string[]> {
	if (Date.now() < cachedApiBasesUntil) return cachedApiBases;
	if (!apiBaseDiscovery) apiBaseDiscovery = discoverApiBases();

	try {
		return await apiBaseDiscovery;
	} finally {
		apiBaseDiscovery = null;
	}
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

function getGifUrl(value: Record<string, unknown>): string | null {
	const rawUrl = typeof value.url === "string" ? value.url :
		typeof value.file_url === "string" ? value.file_url : "";
	if (!rawUrl) return null;

	try {
		const url = new URL(rawUrl);
		// Compatible API instances may serve media from different CDNs.
		if (url.protocol !== "https:" || url.username || url.password) return null;

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
	const animationFlag = value.is_animated ?? value.isAnimated;
	if (!isNsfw || animationFlag === false) return null;

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
		else if (Array.isArray(payload.items)) images = payload.items;
	}
	return images.flatMap((image) => {
		const parsed = parseImage(image);
		return parsed ? [parsed] : [];
	});
}

/** Build a compatible instance's animated NSFW image-search URL. */
export function buildWaifuGifSearchUrl(
	category: NsfwGifCategory,
	useCategoryTag = true,
	apiBase = PRIMARY_API_BASE,
): string {
	const normalizedBase = normalizeApiBase(apiBase);
	if (!normalizedBase) throw new Error("Invalid Waifu API base URL");
	const url = new URL("images", normalizedBase);
	url.searchParams.set("isNsfw", "True");
	url.searchParams.set("isAnimated", "True");
	url.searchParams.set("orderBy", "Random");
	url.searchParams.set("pageSize", "30");

	if (useCategoryTag) {
		for (const tag of CATEGORY_TAGS[category]) url.searchParams.append("includedTags", tag);
	}
	return url.toString();
}

async function requestWaifuGifSearch(
	apiBase: string,
	category: NsfwGifCategory,
	useCategoryTag: boolean,
): Promise<NsfwGifPost[]> {
	const response = await fetch(buildWaifuGifSearchUrl(category, useCategoryTag, apiBase), {
		headers: {
			accept: "application/json",
			"user-agent": "ZangetsuDiscordBot/2.0 (+https://zangetsu.online)",
		},
		signal: AbortSignal.timeout(API_TIMEOUT_MS),
	});

	if (!response.ok) {
		// A category tag may not exist on an instance; the caller can retry broadly.
		if (useCategoryTag && (response.status === 400 || response.status === 404)) return [];
		throw new Error(new URL(apiBase).host + " returned HTTP " + response.status);
	}

	const contentType = response.headers.get("content-type") ?? "";
	if (!contentType.toLowerCase().includes("json")) {
		throw new Error(
			new URL(apiBase).host +
				" returned non-JSON content (HTTP " +
				response.status +
				", content-type: " +
				(contentType || "missing") +
				")",
		);
	}

	let payload: unknown;
	try {
		payload = await response.json();
	} catch {
		throw new Error(new URL(apiBase).host + " returned invalid JSON");
	}
	return parseWaifuGifImages(payload);
}

/** Tries the primary API and healthy registered mirrors, retrying broad tags when needed. */
export async function fetchNsfwGif(category: NsfwGifCategory): Promise<NsfwGifPost | null> {
	let lastError: unknown;
	const apiBases = await getApiBases();

	for (const apiBase of apiBases) {
		try {
			let results = await requestWaifuGifSearch(apiBase, category, true);
			if (results.length === 0 && CATEGORY_TAGS[category].length > 0) {
				results = await requestWaifuGifSearch(apiBase, category, false);
			}
			if (results.length > 0) {
				return results[Math.floor(Math.random() * results.length)] ?? null;
			}
		} catch (error) {
			lastError = error;
		}
	}

	if (lastError !== undefined) {
		const detail =
			typeof lastError === "object" &&
			lastError !== null &&
			"message" in lastError &&
			typeof lastError.message === "string"
				? lastError.message
				: "Unknown provider error";
		throw new Error("All compatible Waifu API instances failed. Last error: " + detail);
	}

	return null;
}
