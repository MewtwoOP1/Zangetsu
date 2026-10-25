import { z } from "zod";
import { fetchJson } from "@lib/infra";

/** Recommendations come from media catalogues, not generated titles. */

export type RecommendationType = "anime" | "movie" | "series";

export interface MediaRecommendation {
	title: string;
	url: string;
	summary: string;
	year: number | null;
	rating: number | null;
	genres: string[];
	poster: string | null;
	source: "AniList" | "TMDB";
}

interface RecommendationInput {
	type: RecommendationType;
	preferences: string;
	tmdbToken?: string;
}

const CACHE_TTL_MS = 15 * 60_000;
const MAX_CACHE_ENTRIES = 250;
const cache = new Map<string, { expiresAt: number; results: MediaRecommendation[] }>();

const GENRE_RULES: {
	name: string;
	pattern: RegExp;
	anilist?: string;
	movie?: number;
	series?: number;
}[] = [
	{ name: "Action", pattern: /\baction\b/i, anilist: "Action", movie: 28, series: 10759 },
	{ name: "Adventure", pattern: /\badventure\b/i, anilist: "Adventure", movie: 12, series: 10759 },
	{ name: "Comedy", pattern: /\bcomedy|comedies|funny\b/i, anilist: "Comedy", movie: 35, series: 35 },
	{ name: "Drama", pattern: /\bdrama\b/i, anilist: "Drama", movie: 18, series: 18 },
	{ name: "Fantasy", pattern: /\bfantasy\b/i, anilist: "Fantasy", movie: 14, series: 10765 },
	{ name: "Mystery", pattern: /\bmystery|mysteries\b/i, anilist: "Mystery", movie: 9648, series: 9648 },
	{ name: "Romance", pattern: /\bromance|romantic|love story\b/i, anilist: "Romance", movie: 10749, series: 10749 },
	{
		name: "Sci-Fi",
		pattern: /\bsci[ -]?fi|science fiction\b/i,
		anilist: "Sci-Fi",
		movie: 878,
		series: 10765,
	},
	{ name: "Horror", pattern: /\bhorror\b/i, anilist: "Horror", movie: 27 },
	{ name: "Psychological", pattern: /\bpsychological|mind game\b/i, anilist: "Psychological" },
	{ name: "Slice of Life", pattern: /\bslice[ -]?of[ -]?life|cozy|relaxing\b/i, anilist: "Slice of Life" },
	{ name: "Supernatural", pattern: /\bsupernatural|ghost story\b/i, anilist: "Supernatural" },
];

const ANILIST_TAG_RULES: { pattern: RegExp; tag: string }[] = [
	{ pattern: /\bover[ -]?powered|\bop mc\b|strong main character|strong protagonist/i, tag: "Overpowered Main Characters" },
	{ pattern: /\bisekai|another world/i, tag: "Isekai" },
	{ pattern: /\breincarnat|reborn/i, tag: "Reincarnation" },
	{ pattern: /\bschool|high school/i, tag: "School" },
	{ pattern: /\btime travel/i, tag: "Time Travel" },
	{ pattern: /\bmagic|wizard|witch/i, tag: "Magic" },
	{ pattern: /\bharem/i, tag: "Harem" },
	{ pattern: /\bsurvival/i, tag: "Survival" },
	{ pattern: /\bdark fantasy/i, tag: "Dark Fantasy" },
];

const anilistMediaSchema = z.object({
	id: z.number(),
	title: z.object({
		english: z.string().nullable().optional(),
		romaji: z.string(),
		native: z.string().nullable().optional(),
	}),
	description: z.string().nullable().optional(),
	coverImage: z.object({ large: z.string().nullable().optional() }).nullable().optional(),
	averageScore: z.number().nullable().optional(),
	genres: z.array(z.string()).default([]),
	seasonYear: z.number().nullable().optional(),
	siteUrl: z.string().url(),
});

const anilistResponseSchema = z.object({
	data: z
		.object({
			Page: z.object({ media: z.array(anilistMediaSchema) }).optional(),
		})
		.nullable()
		.optional(),
	errors: z.array(z.object({ message: z.string() })).optional(),
});

const tmdbResultSchema = z.object({
	id: z.number(),
	title: z.string().optional(),
	name: z.string().optional(),
	overview: z.string().nullable().optional(),
	poster_path: z.string().nullable().optional(),
	vote_average: z.number().nullable().optional(),
	genre_ids: z.array(z.number()).default([]),
	release_date: z.string().optional(),
	first_air_date: z.string().optional(),
});

const tmdbResponseSchema = z.object({ results: z.array(tmdbResultSchema) });

const TMDB_GENRE_NAMES: Record<number, string> = {
	28: "Action",
	12: "Adventure",
	16: "Animation",
	35: "Comedy",
	80: "Crime",
	99: "Documentary",
	18: "Drama",
	10751: "Family",
	14: "Fantasy",
	36: "History",
	27: "Horror",
	10402: "Music",
	9648: "Mystery",
	10749: "Romance",
	878: "Science fiction",
	10770: "TV movie",
	53: "Thriller",
	10752: "War",
	37: "Western",
	10759: "Action & adventure",
	10762: "Kids",
	10763: "News",
	10764: "Reality",
	10765: "Sci-fi & fantasy",
	10766: "Soap",
	10767: "Talk",
	10768: "War & politics",
};

export function detectRecommendationGenre(preferences: string, type: RecommendationType): string | null {
	const matches = GENRE_RULES.flatMap((rule) => {
		const supported = type === "anime" ? rule.anilist : type === "movie" ? rule.movie : rule.series;
		if (supported === undefined) return [];

		const match = rule.pattern.exec(preferences);
		return match === null ? [] : [{ name: rule.name, index: match.index }];
	}).sort((a, b) => a.index - b.index);

	return matches[0]?.name ?? null;
}

/** AniList tags let anime requests include common tropes such as isekai or an overpowered lead. */
export function detectAnimeTag(preferences: string): string | null {
	const matches = ANILIST_TAG_RULES.flatMap((rule) => {
		const match = rule.pattern.exec(preferences);
		return match === null ? [] : [{ tag: rule.tag, index: match.index }];
	}).sort((a, b) => a.index - b.index);

	return matches[0]?.tag ?? null;
}

function genreValue(name: string | null, type: RecommendationType): string | number | null {
	if (name === null) return null;
	const rule = GENRE_RULES.find((candidate) => candidate.name === name);
	if (rule === undefined) return null;
	if (type === "anime") return rule.anilist ?? null;
	return (type === "movie" ? rule.movie : rule.series) ?? null;
}

function cleanSummary(value: string | null | undefined): string {
	return (value ?? "")
		.replace(/<br\s*\/?\s*>/gi, " ")
		.replace(/<\/p\s*>/gi, " ")
		.replace(/<[^>]*>/g, "")
		.replace(/&nbsp;/gi, " ")
		.replace(/&amp;/gi, "&")
		.replace(/&quot;/gi, '"')
		.replace(/&#39;/gi, "'")
		.replace(/\s+/g, " ")
		.trim();
}

function cacheRead(key: string): MediaRecommendation[] | null {
	const entry = cache.get(key);
	if (entry === undefined) return null;
	if (entry.expiresAt <= Date.now()) {
		cache.delete(key);
		return null;
	}

	// Refresh insertion order so the least recently used entry is evicted first.
	cache.delete(key);
	cache.set(key, entry);
	return entry.results;
}

function cacheWrite(key: string, results: MediaRecommendation[]): void {
	cache.delete(key);
	cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, results });
	while (cache.size > MAX_CACHE_ENTRIES) {
		const oldest = cache.keys().next().value;
		if (oldest === undefined) break;
		cache.delete(oldest);
	}
}

/** Clears only the in-memory catalogue cache; exported so tests remain isolated. */
export function clearRecommendationCache(): void {
	cache.clear();
}

const ANILIST_QUERY = `
query ($page: Int, $perPage: Int, $genreIn: [String], $tagIn: [String]) {
  Page(page: $page, perPage: $perPage) {
    media(type: ANIME, isAdult: false, genre_in: $genreIn, tag_in: $tagIn, sort: [SCORE_DESC, POPULARITY_DESC]) {
      id
      title { english romaji native }
      description(asHtml: false)
      coverImage { large }
      averageScore
      genres
      seasonYear
      siteUrl
    }
  }
}`;

async function fetchAnime(genre: string | null, tag: string | null): Promise<MediaRecommendation[]> {
	const genreFilter = genre === null ? null : genreValue(genre, "anime");
	const variables = {
		page: 1,
		perPage: 20,
		...(genreFilter === null ? {} : { genreIn: [genreFilter] }),
		...(tag === null ? {} : { tagIn: [tag] }),
	};

	const payload = await fetchJson("anilist", "https://graphql.anilist.co", anilistResponseSchema, {
		method: "POST",
		headers: { Accept: "application/json", "Content-Type": "application/json" },
		body: JSON.stringify({ query: ANILIST_QUERY, variables }),
	});

	if (payload.errors?.length || payload.data?.Page === undefined || payload.data.Page === undefined) {
		throw new Error(payload.errors?.[0]?.message ?? "AniList returned no catalogue data.");
	}

	return payload.data.Page.media.map((media) => ({
		title: media.title.english?.trim() || media.title.romaji,
		url: media.siteUrl,
		summary: cleanSummary(media.description) || "No synopsis is available.",
		year: media.seasonYear ?? null,
		rating: media.averageScore == null ? null : Math.round((media.averageScore / 10) * 10) / 10,
		genres: media.genres,
		poster: media.coverImage?.large ?? null,
		source: "AniList" as const,
	}));
}

async function fetchMovieOrSeries(
	type: "movie" | "series",
	preferences: string,
	token: string,
): Promise<MediaRecommendation[]> {
	const genre = detectRecommendationGenre(preferences, type);
	const genreFilter = genreValue(genre, type);
	const endpoint = type === "movie" ? "movie" : "tv";
	const payload = await fetchJson("tmdb", `https://api.themoviedb.org/3/discover/${endpoint}`, tmdbResponseSchema, {
		headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
		query: {
			include_adult: false,
			language: "en-US",
			sort_by: genreFilter === null ? "vote_average.desc" : "popularity.desc",
			"vote_count.gte": genreFilter === null ? 500 : 100,
			...(genreFilter === null ? {} : { with_genres: genreFilter }),
			page: 1,
		},
	});

	return payload.results.flatMap((result) => {
		const title = (result.title ?? result.name ?? "").trim();
		if (!title) return [];

		const date = type === "movie" ? result.release_date : result.first_air_date;
		const yearMatch = date?.match(/^\d{4}/);
		const genres = result.genre_ids.map((id) => TMDB_GENRE_NAMES[id]).filter((name): name is string => name !== undefined);
		return [
			{
				title,
				url: `https://www.themoviedb.org/${endpoint}/${result.id}`,
				summary: cleanSummary(result.overview) || "No synopsis is available.",
				year: yearMatch ? Number(yearMatch[0]) : null,
				rating: result.vote_average == null ? null : Math.round(result.vote_average * 10) / 10,
				genres,
				poster: result.poster_path ? `https://image.tmdb.org/t/p/w500${result.poster_path}` : null,
				source: "TMDB" as const,
			},
		];
	});
}

/**
 * Returns up to three real catalogue entries. Results are cached per type/genre/trope for fifteen minutes,
 * which keeps repeated requests cheap and helps stay within upstream rate limits.
 */
export async function recommendMedia(input: RecommendationInput): Promise<MediaRecommendation[]> {
	const { type, preferences, tmdbToken } = input;
	const genre = detectRecommendationGenre(preferences, type);
	const tag = type === "anime" ? detectAnimeTag(preferences) : null;
	const key = `${type}:${genre ?? "all"}:${tag ?? "none"}`;
	const previous = cacheRead(key);
	if (previous !== null) return previous.slice(0, 3);

	let results: MediaRecommendation[];
	if (type === "anime") {
		results = await fetchAnime(genre, tag);
		if (results.length === 0 && tag !== null) results = await fetchAnime(genre, null);
		if (results.length === 0 && genre !== null) results = await fetchAnime(null, null);
	} else {
		if (!tmdbToken) throw new Error("TMDB_API_READ_ACCESS_TOKEN is required for movie and series recommendations.");
		results = await fetchMovieOrSeries(type, preferences, tmdbToken);
	}

	if (results.length === 0) return [];
	cacheWrite(key, results);
	return results.slice(0, 3);
}
