import {
	buildZangetsuAnimeUrl,
	buildZangetsuAniListUrl,
	buildZangetsuTmdbUrl,
	clearRecommendationCache,
	detectAnimeTag,
	detectRecommendationGenre,
	detectRecommendationGenres,
	lookupMedia,
	rankRecommendationsHeuristically,
	rankRecommendationsWithAI,
	recommendMedia,
	recommendationEmbeds,
	type MediaRecommendation,
} from "@lib/recommendations";

const animeResult = {
	id: 1,
	idMal: 61990,
	title: { english: "Test Anime", romaji: "Test Anime", native: null },
	description: "<br/>A story &amp; test</p>",
	coverImage: { large: "https://example.com/anime.jpg" },
	averageScore: 85,
	genres: ["Fantasy"],
	seasonYear: 2024,
	siteUrl: "https://anilist.co/anime/1",
};

function mockJson(payload: unknown): jest.SpyInstance {
	return jest.spyOn(global, "fetch").mockResolvedValue(
		new Response(JSON.stringify(payload), {
			status: 200,
			headers: { "content-type": "application/json" },
		}),
	);
}

describe("media recommendation filters", () => {
	it("detects the first supported genre mentioned by the user", () => {
		expect(detectRecommendationGenre("romance, then fantasy", "anime")).toBe("Romance");
		expect(detectRecommendationGenre("scifi series", "series")).toBe("Sci-Fi");
		expect(detectRecommendationGenre("horror", "series")).toBeNull();
		expect(detectRecommendationGenre("something different", "movie")).toBeNull();
		expect(detectRecommendationGenres("fantasy romance with mystery", "manga")).toEqual([
			"Fantasy", "Romance", "Mystery",
		]);
	});

	it("detects common anime tropes without requiring an AI call", () => {
		expect(detectAnimeTag("fantasy with an overpowered MC")).toBe("Overpowered Main Characters");
		expect(detectAnimeTag("isekai with reincarnation")).toBe("Isekai");
		expect(detectAnimeTag("give me a cozy romance")).toBe("Iyashikei");
	});
});

describe("recommendationEmbeds", () => {
	it("renders catalogue metadata, links, ratings, and TMDB attribution", () => {
		const item: MediaRecommendation = {
			title: "Test Movie",
			url: "https://zangetsu.online/open/?s=zm&u=zm%3A%2F%2Fmovie%2Ftmdb%3A42&t=Test+Movie&y=m&c=https%3A%2F%2Fimage.tmdb.org%2Ft%2Fp%2Fw500%2Fposter.jpg",
			summary: "A test synopsis.",
			year: 2024,
			rating: 8.1,
			genres: ["Science fiction"],
			poster: "https://image.tmdb.org/t/p/w342/poster.jpg",
			source: "TMDB",
		};

		const result = recommendationEmbeds([item])[0]?.data;

		expect(result).toMatchObject({
			title: "1. Test Movie",
			url: item.url,
			description: "A test synopsis.",
			thumbnail: { url: item.poster },
			fields: [
				{ name: "Rating", value: "8.1/10", inline: true },
				{ name: "Year", value: "2024", inline: true },
				{ name: "Genres", value: "Science fiction", inline: true },
			],
			footer: { text: "This product uses the TMDB API but is not endorsed or certified by TMDB." },
		});
	});

	it("handles missing metadata and AniList attribution", () => {
		const result = recommendationEmbeds([
			{
				title: "Test Anime",
				url: "https://anilist.co/anime/1",
				summary: "Synopsis.",
				year: null,
				rating: null,
				genres: [],
				poster: null,
				source: "AniList",
			},
		])[0]?.data;

		expect(result?.fields).toEqual([
			{ name: "Rating", value: "Not rated", inline: true },
			{ name: "Year", value: "Unknown", inline: true },
			{ name: "Genres", value: "Not listed", inline: true },
		]);
		expect(result?.thumbnail).toBeUndefined();
		expect(result?.footer?.text).toBe("Source: AniList");
	});
});

describe("buildZangetsuAnimeUrl", () => {
	it("builds the app hand-off URL with encoded MAL ID, title, and cover", () => {
		const result = new URL(
			buildZangetsuAnimeUrl({
				malId: 61990,
				title: "Cyberpunk: Edgerunners 2",
				cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/test.png",
			}),
		);

		expect(result.origin + result.pathname).toBe("https://zangetsu.online/open/");
		expect(result.searchParams.get("s")).toBe("zm");
		expect(result.searchParams.get("u")).toBe("zm://anime/mal:61990");
		expect(result.searchParams.get("t")).toBe("Cyberpunk: Edgerunners 2");
		expect(result.searchParams.get("y")).toBe("a");
		expect(result.searchParams.get("c")).toBe(
			"https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/test.png",
		);
	});

	it("omits the cover parameter when no cover image is available", () => {
		const result = new URL(buildZangetsuAnimeUrl({ malId: 61990, title: "Test Anime" }));
		expect(result.searchParams.has("c")).toBe(false);
	});
});

describe("buildZangetsuAniListUrl", () => {
	it.each([
		["manga", "zm://manga/mal:42", "g"],
		["novel", "zm://novel/mal:42", "n"],
	] as const)("builds the Zangetsu deep link for %s", (mediaType, showUrl, kindCode) => {
		const result = new URL(buildZangetsuAniListUrl({
			anilistId: 9_999,
			malId: 42,
			title: "A good title",
			mediaType,
			cover: "https://example.com/cover.jpg",
		}));

		expect(result.origin + result.pathname).toBe("https://zangetsu.online/open/");
		expect(result.searchParams.get("s")).toBe("zm");
		expect(result.searchParams.get("u")).toBe(showUrl);
		expect(result.searchParams.get("y")).toBe(kindCode);
		expect(result.searchParams.get("t")).toBe("A good title");
	});

	it("uses the AniList ID when a MAL ID is unavailable", () => {
		const result = new URL(buildZangetsuAniListUrl({
			anilistId: 30013,
			title: "Manga without MAL",
			mediaType: "manga",
		}));
		expect(result.searchParams.get("u")).toBe("zm://manga/al:30013");
		expect(result.searchParams.has("c")).toBe(false);
	});
});

describe("buildZangetsuTmdbUrl", () => {
	it("builds the app hand-off URL from the TMDB movie format", () => {
		const result = new URL(
			buildZangetsuTmdbUrl({
				tmdbId: 1101412,
				title: "Fall 2: Deadpoint",
				type: "movie",
				cover: "https://image.tmdb.org/t/p/w342/fgSm5ylwiXbIHn8UbUXDjk9RRu4.jpg",
			}),
		);

		expect(result.origin + result.pathname).toBe("https://zangetsu.online/open/");
		expect(result.searchParams.get("s")).toBe("zm");
		expect(result.searchParams.get("u")).toBe("zm://movie/tmdb:1101412");
		expect(result.searchParams.get("t")).toBe("Fall 2: Deadpoint");
		expect(result.searchParams.get("y")).toBe("m");
		expect(result.searchParams.get("c")).toBe(
			"https://image.tmdb.org/t/p/w342/fgSm5ylwiXbIHn8UbUXDjk9RRu4.jpg",
		);
	});

	it("builds a TV hand-off URL and omits an unavailable cover", () => {
		const result = new URL(buildZangetsuTmdbUrl({ tmdbId: 55, title: "Test Series", type: "series" }));

		expect(result.searchParams.get("u")).toBe("zm://tv/tmdb:55");
		expect(result.searchParams.get("y")).toBe("t");
		expect(result.searchParams.has("c")).toBe(false);
	});
});

describe("lookupMedia", () => {
	beforeEach(() => {
		clearRecommendationCache();
		jest.restoreAllMocks();
	});

	afterEach(() => {
		clearRecommendationCache();
		jest.restoreAllMocks();
	});

	it("searches AniList by title and returns ranking and popularity statistics", async () => {
		mockJson({
			data: {
				Page: {
					media: [{
						...animeResult,
						meanScore: 84,
						popularity: 120_000,
						favourites: 12_000,
						format: "TV",
						status: "FINISHED",
						episodes: 24,
						duration: 24,
						rankings: [
							{ rank: 7, type: "RATED", context: "highest rated all time", allTime: true },
							{ rank: 21, type: "POPULAR", context: "most popular all time", allTime: true },
						],
					}],
				},
			},
		});

		const results = await lookupMedia({ query: "Test Anime", type: "anime" });

		expect(results[0]).toEqual(expect.objectContaining({
			title: "Test Anime",
			source: "AniList",
			mediaType: "anime",
			rating: 8.5,
			popularity: 120_000,
			favourites: 12_000,
			episodes: 24,
			duration: 24,
			rank: 7,
			popularityRank: 21,
			status: "FINISHED",
			format: "TV",
		}));
		const body = JSON.parse(String(jest.mocked(global.fetch).mock.calls[0]?.[1]?.body));
		expect(body.query).toContain("SEARCH_MATCH");
		expect(body.variables).toEqual({ search: "Test Anime", page: 1, perPage: 10, mediaType: "ANIME" });
	});
});

describe("recommendation ranking", () => {
	const baseItem = (overrides: Partial<MediaRecommendation>): MediaRecommendation => ({
		title: "Generic Title",
		url: "https://anilist.co/anime/1",
		summary: "A story.",
		year: 2024,
		rating: 8,
		genres: [],
		poster: null,
		source: "AniList",
		mediaType: "anime",
		...overrides,
	});

	it("ranks relevant genre and synopsis matches above popularity-only choices", () => {
		const fantasy = baseItem({ title: "Fantasy Quest", genres: ["Fantasy"], rating: 9.8 });
		const romance = baseItem({
			title: "Quiet Spring",
			summary: "A slow burn story about two people slowly falling in love.",
			genres: ["Romance", "Slice of Life"],
			rating: 8.1,
		});
		expect(rankRecommendationsHeuristically([fantasy, romance], "slow burn romance")[0]).toBe(romance);
	});

	it("uses AI to reorder only the supplied catalogue IDs, then keeps unranked titles", async () => {
		const first = baseItem({ title: "First", url: "https://example.com/1" });
		const second = baseItem({ title: "Second", url: "https://example.com/2" });
		jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({
			choices: [{ message: { content: '{"rankedIds":[1,0]}' } }],
		}), { status: 200, headers: { "content-type": "application/json" } }));

		const result = await rankRecommendationsWithAI([first, second], "slow burn romance", "test-key");

		expect(result.map((item) => item.title)).toEqual(["Second", "First"]);
		expect(String(jest.mocked(global.fetch).mock.calls[0]?.[0])).toContain("openrouter.ai/api/v1/chat/completions");
	});

	it("does not call a hosted AI service when no optional key is configured", async () => {
		const fetchMock = jest.spyOn(global, "fetch");
		const items = [baseItem({ title: "One" }), baseItem({ title: "Two" })];

		expect(await rankRecommendationsWithAI(items, "fantasy")).toEqual(items);
		expect(fetchMock).not.toHaveBeenCalled();
	});
});

describe("recommendMedia", () => {
	beforeEach(() => {
		clearRecommendationCache();
		jest.restoreAllMocks();
	});

	afterEach(() => {
		clearRecommendationCache();
		jest.restoreAllMocks();
	});

	it("returns relevant anime, manga, light novels, and TMDB picks for all media", async () => {
		const animeItems = Array.from({ length: 3 }, (_, index) => ({
			...animeResult,
			id: index + 1,
			idMal: 61_990 + index,
			title: { english: `Top Anime ${index + 1}`, romaji: `Top Anime ${index + 1}`, native: null },
			averageScore: 96 - index,
			format: "TV",
		}));
		const mangaItems = Array.from({ length: 3 }, (_, index) => ({
			...animeResult,
			id: 100 + index,
			idMal: 20_000 + index,
			title: { english: `Top Manga ${index + 1}`, romaji: `Top Manga ${index + 1}`, native: null },
			averageScore: 95 - index,
			format: "MANGA",
			chapters: 100 + index,
			volumes: 12 + index,
		}));
		const novelItems = Array.from({ length: 3 }, (_, index) => ({
			...animeResult,
			id: 200 + index,
			idMal: 30_000 + index,
			title: { english: `Top Novel ${index + 1}`, romaji: `Top Novel ${index + 1}`, native: null },
			averageScore: 94 - index,
			format: "NOVEL",
			chapters: 150 + index,
			volumes: 8 + index,
		}));
		const movieItems = [
			{
				id: 101, title: "Top Movie", overview: "Movie synopsis.", poster_path: null,
				vote_average: 9.2, vote_count: 1_200, popularity: 80, genre_ids: [14], release_date: "2024-01-01",
			},
			{
				id: 102, title: "Second Movie", overview: "Movie synopsis.", poster_path: null,
				vote_average: 8.7, vote_count: 900, popularity: 50, genre_ids: [14], release_date: "2023-01-01",
			},
			{
				id: 103, title: "Third Movie", overview: "Movie synopsis.", poster_path: null,
				vote_average: 8.5, vote_count: 700, popularity: 40, genre_ids: [14], release_date: "2022-01-01",
			},
		];
		const seriesItems = [
			{
				id: 201, name: "Top Series", overview: "Series synopsis.", poster_path: null,
				vote_average: 9.1, vote_count: 2_000, popularity: 90, genre_ids: [10765], first_air_date: "2024-01-01",
			},
			{
				id: 202, name: "Second Series", overview: "Series synopsis.", poster_path: null,
				vote_average: 8.9, vote_count: 800, popularity: 60, genre_ids: [10765], first_air_date: "2023-01-01",
			},
			{
				id: 203, name: "Third Series", overview: "Series synopsis.", poster_path: null,
				vote_average: 8.4, vote_count: 600, popularity: 30, genre_ids: [10765], first_air_date: "2022-01-01",
			},
		];
		const fetchMock = jest.spyOn(global, "fetch").mockImplementation(async (input, init) => {
			const url = String(input);
			let payload: unknown;
			if (url.includes("graphql.anilist.co")) {
				const body = JSON.parse(String(init?.body));
				const variables = body.variables as { mediaType: string; formatIn?: string[] };
				const media = variables.mediaType === "ANIME"
					? animeItems
					: variables.formatIn?.includes("NOVEL")
						? novelItems
						: mangaItems;
				payload = { data: { Page: { media } } };
			} else {
				payload = url.includes("/discover/movie?") ? { results: movieItems } : { results: seriesItems };
			}
			return new Response(JSON.stringify(payload), {
				status: 200,
				headers: { "content-type": "application/json" },
			});
		});

		const results = await recommendMedia({ type: "all", preferences: "", tmdbToken: "test-token" });

		expect(results).toHaveLength(10);
		expect(results.filter((item) => item.mediaType === "anime")).toHaveLength(2);
		expect(results.filter((item) => item.mediaType === "manga")).toHaveLength(2);
		expect(results.filter((item) => item.mediaType === "novel")).toHaveLength(2);
		expect(results.filter((item) => item.mediaType === "movie" || item.mediaType === "series")).toHaveLength(4);
		expect(results.find((item) => item.mediaType === "manga")?.url).toContain("zm%3A%2F%2Fmanga%2Fmal%3A");
		expect(results.find((item) => item.mediaType === "novel")?.url).toContain("zm%3A%2F%2Fnovel%2Fmal%3A");
		expect(fetchMock).toHaveBeenCalledTimes(5);
	});
	it("fetches anime from AniList, cleans the synopsis, scales ratings, and caches the result", async () => {
		const fetchMock = mockJson({ data: { Page: { media: [animeResult] } } });

		const first = await recommendMedia({ type: "anime", preferences: "fantasy" });
		const second = await recommendMedia({ type: "anime", preferences: "fantasy" });

		expect(first).toEqual([
			expect.objectContaining({
				title: "Test Anime",
				url: "https://zangetsu.online/open/?s=zm&u=zm%3A%2F%2Fanime%2Fmal%3A61990&t=Test+Anime&y=a&c=https%3A%2F%2Fexample.com%2Fanime.jpg",
				summary: "A story & test",
				year: 2024,
				rating: 8.5,
				genres: ["Fantasy"],
				poster: "https://example.com/anime.jpg",
				source: "AniList",
			}),
		]);
		expect(second).toEqual(first);
		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(fetchMock.mock.calls[0]?.[0]).toBe("https://graphql.anilist.co");
		expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)).variables).toEqual({
			page: 1,
			perPage: 50,
			mediaType: "ANIME",
			genreIn: ["Fantasy"],
		});
	});

	it("deduplicates concurrent requests for the same recommendation filter", async () => {
		const fetchMock = jest.spyOn(global, "fetch").mockImplementation(async () =>
			new Response(JSON.stringify({ data: { Page: { media: [animeResult] } } }), {
				status: 200,
				headers: { "content-type": "application/json" },
			}),
		);

		const first = recommendMedia({ type: "anime", preferences: "fantasy" });
		const second = recommendMedia({ type: "anime", preferences: "fantasy" });

		await expect(Promise.all([first, second])).resolves.toHaveLength(2);
		// One filtered and one broad catalogue request are shared by both callers.
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("retries anime without a trope filter when that filter has no results", async () => {
		const fetchMock = jest.spyOn(global, "fetch")
			.mockResolvedValueOnce(new Response(JSON.stringify({ data: { Page: { media: [] } } }), { status: 200 }))
			.mockResolvedValueOnce(new Response(JSON.stringify({ data: { Page: { media: [animeResult] } } }), { status: 200 }))
			.mockResolvedValueOnce(new Response(JSON.stringify({ data: { Page: { media: [animeResult] } } }), { status: 200 }));

		const results = await recommendMedia({
			type: "anime",
			preferences: "fantasy with an isekai plot",
		});

		expect(results).toHaveLength(1);
		expect(fetchMock).toHaveBeenCalledTimes(3);
		expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)).variables).toEqual({
			page: 1,
			perPage: 50,
			mediaType: "ANIME",
			genreIn: ["Fantasy"],
		});
	});

	it("uses vote-average ranking for genre-filtered TMDB recommendations", async () => {
		const fetchMock = mockJson({
			results: [{
				id: 42,
				title: "Test Movie",
				overview: "A test movie.",
				poster_path: null,
				vote_average: 8.1,
				vote_count: 1_200,
				popularity: 42,
				genre_ids: [878],
				release_date: "2024-01-02",
			}],
		});

		await recommendMedia({ type: "movie", preferences: "sci-fi", tmdbToken: "test-token" });

		expect(fetchMock.mock.calls[0]?.[0]).toContain("sort_by=vote_average.desc");
		expect(fetchMock.mock.calls[0]?.[0]).toContain("with_genres=878");
	});

	it("uses TMDB bearer authentication and normalises movie metadata", async () => {
		const fetchMock = mockJson({
			results: [
				{
					id: 42,
					title: "Test Movie",
					overview: "A test movie.",
					poster_path: "/poster.jpg",
					vote_average: 8.1,
					genre_ids: [878],
					release_date: "2024-01-02",
				},
			],
		});

		const results = await recommendMedia({
			type: "movie",
			preferences: "sci-fi",
			tmdbToken: "test-token",
		});

		expect(results).toEqual([
			expect.objectContaining({
				title: "Test Movie",
				url: "https://zangetsu.online/open/?s=zm&u=zm%3A%2F%2Fmovie%2Ftmdb%3A42&t=Test+Movie&y=m&c=https%3A%2F%2Fimage.tmdb.org%2Ft%2Fp%2Fw500%2Fposter.jpg",
				summary: "A test movie.",
				year: 2024,
				rating: 8.1,
				genres: ["Science fiction"],
				poster: "https://image.tmdb.org/t/p/w342/poster.jpg",
				source: "TMDB",
			}),
		]);
		expect(fetchMock.mock.calls[0]?.[0]).toContain("/discover/movie?");
		expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get("Authorization")).toBe("Bearer test-token");
	});

	it("uses the TV endpoint and first air date for series", async () => {
		const fetchMock = mockJson({
			results: [
				{
					id: 55,
					name: "Test Series",
					overview: "A series.",
					poster_path: null,
					vote_average: 7.5,
					genre_ids: [10765],
					first_air_date: "2021-03-04",
				},
			],
		});

		const results = await recommendMedia({ type: "series", preferences: "fantasy", tmdbToken: "test-token" });

		expect(results[0]).toEqual(
			expect.objectContaining({
				title: "Test Series",
				url: "https://zangetsu.online/open/?s=zm&u=zm%3A%2F%2Ftv%2Ftmdb%3A55&t=Test+Series&y=t",
				year: 2021,
				rating: 7.5,
				genres: ["Sci-fi & fantasy"],
				poster: null,
				source: "TMDB",
			}),
		);
		expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/discover/tv?"), expect.any(Object));
	});

	it("refuses movie recommendations without a TMDB token before making a request", async () => {
		const fetchMock = jest.spyOn(global, "fetch");

		await expect(recommendMedia({ type: "movie", preferences: "" })).rejects.toThrow(
			"TMDB_API_READ_ACCESS_TOKEN is required",
		);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("returns no results without caching an empty catalogue", async () => {
		const fetchMock = mockJson({ results: [] });

		expect(await recommendMedia({ type: "movie", preferences: "fantasy", tmdbToken: "test-token" })).toEqual(
			[],
		);
		expect(await recommendMedia({ type: "movie", preferences: "fantasy", tmdbToken: "test-token" })).toEqual(
			[],
		);
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});
});
