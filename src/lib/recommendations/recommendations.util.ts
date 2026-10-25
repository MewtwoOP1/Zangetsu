import { z } from "zod";
import { fetchJson } from "@lib/infra";

/** Recommendations come from media catalogues, not generated titles. */

export type MediaType = "anime" | "movie" | "series";
export type RecommendationType = MediaType | "all";
export type MediaLookupType = MediaType | "all";

export interface MediaRecommendation {
	title: string;
	url: string;
	summary: string;
	year: number | null;
	rating: number | null;
	genres: string[];
	poster: string | null;
	source: "AniList" | "TMDB";
	mediaType?: MediaType;
	status?: string | null;
	format?: string | null;
	episodes?: number | null;
	duration?: number | null;
	popularity?: number | null;
	favourites?: number | null;
	voteCount?: number | null;
	rank?: number | null;
	popularityRank?: number | null;
}

export interface RecommendationInput {
	type: RecommendationType;
	preferences: string;
	tmdbToken?: string;
}

const CACHE_TTL_MS = 15 * 60_000;
const MAX_CACHE_ENTRIES = 250;
const cache = new Map<string, { expiresAt: number; results: MediaRecommendation[] }>();
const inFlight = new Map<string, Promise<MediaRecommendation[]>>();

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
	idMal: z.number().nullable().optional(),
	title: z.object({
		english: z.string().nullable().optional(),
		romaji: z.string(),
		native: z.string().nullable().optional(),
	}),
	description: z.string().nullable().optional(),
	coverImage: z.object({ large: z.string().nullable().optional() }).nullable().optional(),
	averageScore: z.number().nullable().optional(),
	meanScore: z.number().nullable().optional(),
	popularity: z.number().nullable().optional(),
	favourites: z.number().nullable().optional(),
	format: z.string().nullable().optional(),
	status: z.string().nullable().optional(),
	episodes: z.number().nullable().optional(),
	duration: z.number().nullable().optional(),
	rankings: z.array(z.object({
		rank: z.number(),
		type: z.string(),
		context: z.string().nullable().optional(),
		allTime: z.boolean().nullable().optional(),
	})).nullable().optional(),
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
	vote_count: z.number().nullable().optional(),
	popularity: z.number().nullable().optional(),
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

export function detectRecommendationGenre(preferences: string, type: MediaType): string | null {
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

function genreValue(name: string | null, type: MediaType): string | number | null {
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
	inFlight.clear();
}

const ANILIST_QUERY = `
query ($page: Int, $perPage: Int, $genreIn: [String], $tagIn: [String]) {
  Page(page: $page, perPage: $perPage) {
    media(type: ANIME, isAdult: false, genre_in: $genreIn, tag_in: $tagIn, sort: [SCORE_DESC, POPULARITY_DESC]) {
      id
      idMal
      title { english romaji native }
      description(asHtml: false)
      coverImage { large }
      averageScore
      meanScore
      popularity
      favourites
      format
      status
      episodes
      duration
      rankings { rank type context allTime }
      genres
      seasonYear
      siteUrl
    }
  }
}`;

const ANILIST_LOOKUP_QUERY = `
query ($search: String, $page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    media(type: ANIME, search: $search, isAdult: false, sort: [SEARCH_MATCH, SCORE_DESC]) {
      id
      idMal
      title { english romaji native }
      description(asHtml: false)
      coverImage { large }
      averageScore
      meanScore
      popularity
      favourites
      format
      status
      episodes
      duration
      rankings { rank type context allTime }
      genres
      seasonYear
      siteUrl
    }
  }
}`;

/** Builds the Zangetsu hand-off URL from a MAL ID, title, and optional cover image. */
export function buildZangetsuAnimeUrl(input: {
	malId: number;
	title: string;
	cover?: string | null;
}): string {
	const url = new URL("https://zangetsu.online/open/");
	url.searchParams.set("s", "zm");
	url.searchParams.set("u", `zm://anime/mal:${input.malId}`);
	url.searchParams.set("t", input.title);
	url.searchParams.set("y", "a");
	if (input.cover) url.searchParams.set("c", input.cover);
	return url.toString();
}

/** Builds the Zangetsu hand-off URL for a TMDB movie or TV series. */
export function buildZangetsuTmdbUrl(input: {
	tmdbId: number;
	title: string;
	type: "movie" | "series";
	cover?: string | null;
}): string {
	const url = new URL("https://zangetsu.online/open/");
	url.searchParams.set("s", "zm");
	url.searchParams.set("u", `zm://${input.type === "movie" ? "movie" : "tv"}/tmdb:${input.tmdbId}`);
	url.searchParams.set("t", input.title);
	url.searchParams.set("y", input.type === "movie" ? "m" : "t");
	if (input.cover) url.searchParams.set("c", input.cover);
	return url.toString();
}

function mapAniListMedia(media: z.infer<typeof anilistMediaSchema>): MediaRecommendation {
	const title = media.title.english?.trim() || media.title.romaji;
	const ratedRank =
		media.rankings?.find((entry) => entry.type === "RATED" && entry.allTime)
		?? media.rankings?.find((entry) => entry.type === "RATED");
	const popularRank =
		media.rankings?.find((entry) => entry.type === "POPULAR" && entry.allTime)
		?? media.rankings?.find((entry) => entry.type === "POPULAR");

	return {
		title,
		url:
			media.idMal == null
				? media.siteUrl
				: buildZangetsuAnimeUrl({
						malId: media.idMal,
						title,
						cover: media.coverImage?.large ?? null,
					}),
		summary: cleanSummary(media.description) || "No synopsis is available.",
		year: media.seasonYear ?? null,
		rating: media.averageScore == null ? null : Math.round(media.averageScore) / 10,
		genres: media.genres,
		poster: media.coverImage?.large ?? null,
		source: "AniList",
		mediaType: "anime",
		status: media.status ?? null,
		format: media.format ?? null,
		episodes: media.episodes ?? null,
		duration: media.duration ?? null,
		popularity: media.popularity ?? null,
		favourites: media.favourites ?? null,
		rank: ratedRank?.rank ?? null,
		popularityRank: popularRank?.rank ?? null,
	};
}

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

	const mediaList = payload.data?.Page?.media;
	if (payload.errors?.length || mediaList === undefined) {
		throw new Error(payload.errors?.[0]?.message ?? "AniList returned no catalogue data.");
	}

	return mediaList.map(mapAniListMedia);
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
			sort_by: "vote_average.desc",
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
		const poster = result.poster_path ? `https://image.tmdb.org/t/p/w500${result.poster_path}` : null;
		return [
			{
				title,
				url: buildZangetsuTmdbUrl({ tmdbId: result.id, title, type, cover: poster }),
				summary: cleanSummary(result.overview) || "No synopsis is available.",
				year: yearMatch ? Number(yearMatch[0]) : null,
				rating: result.vote_average == null ? null : Math.round(result.vote_average * 10) / 10,
				genres,
				poster,
				source: "TMDB" as const,
				mediaType: type,
				voteCount: result.vote_count ?? null,
				popularity: result.popularity ?? null,
			},
		];
	});
}

/**
 * Catalogue order is intentional: AniList supplies score/popularity ranking and TMDB supplies vote-average
 * ranking with a minimum vote count. Sessions can move through the ranked results without refetching each click.
 */
export async function recommendMedia(input: RecommendationInput): Promise<MediaRecommendation[]> {
	const { type, preferences, tmdbToken } = input;
	const animeGenre = detectRecommendationGenre(preferences, "anime");
	const genre = type === "all" ? null : detectRecommendationGenre(preferences, type);
	const tag = type === "anime" || type === "all" ? detectAnimeTag(preferences) : null;
	const key =
		type === "all"
			? [
					"all",
					animeGenre ?? "all",
					detectRecommendationGenre(preferences, "movie") ?? "all",
					detectRecommendationGenre(preferences, "series") ?? "all",
					tag ?? "none",
				].join(":")
			: type + ":" + (genre ?? "all") + ":" + (tag ?? "none");
	const limit = type === "all" ? 6 : 20;
	const previous = cacheRead(key);
	if (previous !== null) return previous.slice(0, limit);

	// Concurrent requests for the same preference set share one upstream API call.
	const pending = inFlight.get(key);
	if (pending !== undefined) return (await pending).slice(0, limit);

	const request = (async (): Promise<MediaRecommendation[]> => {
		if (type === "anime") {
			let results = await fetchAnime(genre, tag);
			if (results.length === 0 && tag !== null) results = await fetchAnime(genre, null);
			if (results.length === 0 && genre !== null) results = await fetchAnime(null, null);
			return results;
		}

		if (type === "all") {
			if (!tmdbToken) {
				throw new Error("TMDB_API_READ_ACCESS_TOKEN is required for all-media recommendations.");
			}
			let anime = await fetchAnime(animeGenre, tag);
			if (anime.length === 0 && tag !== null) anime = await fetchAnime(animeGenre, null);
			if (anime.length === 0 && animeGenre !== null) anime = await fetchAnime(null, null);
			const [movies, series] = await Promise.all([
				fetchMovieOrSeries("movie", preferences, tmdbToken),
				fetchMovieOrSeries("series", preferences, tmdbToken),
			]);
			const tmdbTopThree = [...movies, ...series]
				.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1) || (b.voteCount ?? 0) - (a.voteCount ?? 0))
				.slice(0, 3);
			return [...anime.slice(0, 3), ...tmdbTopThree];
		}

		if (!tmdbToken) {
			throw new Error("TMDB_API_READ_ACCESS_TOKEN is required for movie and series recommendations.");
		}
		return fetchMovieOrSeries(type, preferences, tmdbToken);
	})();

	inFlight.set(key, request);
	try {
		const results = await request;
		if (results.length > 0) cacheWrite(key, results);
		return results.slice(0, limit);
	} finally {
		inFlight.delete(key);
	}
}

async function fetchAnimeSearch(query: string): Promise<MediaRecommendation[]> {
	const payload = await fetchJson("anilist", "https://graphql.anilist.co", anilistResponseSchema, {
		method: "POST",
		headers: { Accept: "application/json", "Content-Type": "application/json" },
		body: JSON.stringify({ query: ANILIST_LOOKUP_QUERY, variables: { search: query, page: 1, perPage: 10 } }),
	});
	const mediaList = payload.data?.Page?.media;
	if (payload.errors?.length || mediaList === undefined) {
		throw new Error(payload.errors?.[0]?.message ?? "AniList returned no lookup data.");
	}
	return mediaList.map(mapAniListMedia);
}

async function fetchTmdbSearch(
	type: "movie" | "series",
	query: string,
	token: string,
): Promise<MediaRecommendation[]> {
	const endpoint = type === "movie" ? "movie" : "tv";
	const payload = await fetchJson("tmdb", `https://api.themoviedb.org/3/search/${endpoint}`, tmdbResponseSchema, {
		headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
		query: { query, include_adult: false, language: "en-US", page: 1 },
	});
	return payload.results.flatMap((result) => {
		const title = (result.title ?? result.name ?? "").trim();
		if (!title) return [];
		const date = type === "movie" ? result.release_date : result.first_air_date;
		const yearMatch = date?.match(/^\d{4}/);
		const poster = result.poster_path ? `https://image.tmdb.org/t/p/w500${result.poster_path}` : null;
		return [
			{
				title,
				url: buildZangetsuTmdbUrl({ tmdbId: result.id, title, type, cover: poster }),
				summary: cleanSummary(result.overview) || "No synopsis is available.",
				year: yearMatch ? Number(yearMatch[0]) : null,
				rating: result.vote_average == null ? null : Math.round(result.vote_average * 10) / 10,
				genres: result.genre_ids
					.map((id) => TMDB_GENRE_NAMES[id])
					.filter((name): name is string => name !== undefined),
				poster,
				source: "TMDB" as const,
				mediaType: type,
				voteCount: result.vote_count ?? null,
				popularity: result.popularity ?? null,
			},
		];
	});
}

/** Searches AniList and/or TMDB. Lookup results carry catalogue stats and are cached for fifteen minutes. */
export async function lookupMedia(input: {
	query: string;
	type: MediaLookupType;
	tmdbToken?: string;
}): Promise<MediaRecommendation[]> {
	const query = input.query.trim();
	if (!query || query.length > 100) return [];
	const cacheKey = `lookup:${input.type}:${query.toLocaleLowerCase()}`;
	const previous = cacheRead(cacheKey);
	if (previous !== null) return previous;
	const pending = inFlight.get(cacheKey);
	if (pending !== undefined) return pending;

	const request = (async (): Promise<MediaRecommendation[]> => {
		if (input.type === "anime") return fetchAnimeSearch(query);
		if (input.type === "movie" || input.type === "series") {
			if (!input.tmdbToken) throw new Error("TMDB_API_READ_ACCESS_TOKEN is required for movie and series lookups.");
			return fetchTmdbSearch(input.type, query, input.tmdbToken);
		}
		if (!input.tmdbToken) {
			throw new Error("TMDB_API_READ_ACCESS_TOKEN is required for all-media lookups.");
		}

		const settled = await Promise.allSettled([
			fetchAnimeSearch(query),
			fetchTmdbSearch("movie", query, input.tmdbToken),
			fetchTmdbSearch("series", query, input.tmdbToken),
		]);
		const results = settled.flatMap((entry) => entry.status === "fulfilled" ? entry.value : []);
		if (results.length === 0) {
			const firstError = settled.find((entry): entry is PromiseRejectedResult => entry.status === "rejected");
			if (firstError) throw firstError.reason;
		}

		const normalized = query.toLocaleLowerCase();
		const relevance = (item: MediaRecommendation): number => {
			const title = item.title.toLocaleLowerCase();
			if (title === normalized) return 0;
			if (title.startsWith(normalized)) return 1;
			if (title.includes(normalized)) return 2;
			return 3;
		};
		return results.sort((a, b) => relevance(a) - relevance(b) || (b.rating ?? -1) - (a.rating ?? -1)).slice(0, 30);
	})();

	inFlight.set(cacheKey, request);
	try {
		const results = await request;
		if (results.length > 0) cacheWrite(cacheKey, results);
		return results;
	} finally {
		inFlight.delete(cacheKey);
	}
}
