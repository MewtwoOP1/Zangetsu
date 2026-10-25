import {
	clearRecommendationCache,
	detectAnimeTag,
	detectRecommendationGenre,
	recommendMedia,
	recommendationEmbeds,
	type MediaRecommendation,
} from "@lib/recommendations";

const animeResult = {
	id: 1,
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
	});

	it("detects common anime tropes without requiring an AI call", () => {
		expect(detectAnimeTag("fantasy with an overpowered MC")).toBe("Overpowered Main Characters");
		expect(detectAnimeTag("isekai with reincarnation")).toBe("Isekai");
		expect(detectAnimeTag("give me a cozy romance")).toBeNull();
	});
});

describe("recommendationEmbeds", () => {
	it("renders catalogue metadata, links, ratings, and TMDB attribution", () => {
		const item: MediaRecommendation = {
			title: "Test Movie",
			url: "https://www.themoviedb.org/movie/42",
			summary: "A test synopsis.",
			year: 2024,
			rating: 8.1,
			genres: ["Science fiction"],
			poster: "https://image.tmdb.org/t/p/w500/poster.jpg",
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

describe("recommendMedia", () => {
	beforeEach(() => {
		clearRecommendationCache();
		jest.restoreAllMocks();
	});

	afterEach(() => {
		clearRecommendationCache();
		jest.restoreAllMocks();
	});

	it("fetches anime from AniList, cleans the synopsis, scales ratings, and caches the result", async () => {
		const fetchMock = mockJson({ data: { Page: { media: [animeResult] } } });

		const first = await recommendMedia({ type: "anime", preferences: "fantasy" });
		const second = await recommendMedia({ type: "anime", preferences: "fantasy" });

		expect(first).toEqual([
			expect.objectContaining({
				title: "Test Anime",
				url: "https://anilist.co/anime/1",
				summary: "A story & test",
				year: 2024,
				rating: 8.5,
				genres: ["Fantasy"],
				poster: "https://example.com/anime.jpg",
				source: "AniList",
			}),
		]);
		expect(second).toEqual(first);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock.mock.calls[0]?.[0]).toBe("https://graphql.anilist.co");
		expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)).variables).toEqual({
			page: 1,
			perPage: 20,
			genreIn: ["Fantasy"],
		});
	});

	it("deduplicates concurrent requests for the same recommendation filter", async () => {
		let resolveFetch: ((response: Response) => void) | undefined;
		const fetchMock = jest.spyOn(global, "fetch").mockImplementation(
			() =>
				new Promise<Response>((resolve) => {
					resolveFetch = resolve;
				}),
		);

		const first = recommendMedia({ type: "anime", preferences: "fantasy" });
		const second = recommendMedia({ type: "anime", preferences: "fantasy" });

		expect(fetchMock).toHaveBeenCalledTimes(1);
		resolveFetch?.(
			new Response(JSON.stringify({ data: { Page: { media: [animeResult] } } }), { status: 200 }),
		);
		await expect(Promise.all([first, second])).resolves.toHaveLength(2);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("retries anime without a trope filter when that filter has no results", async () => {
		const fetchMock = jest
			.spyOn(global, "fetch")
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ data: { Page: { media: [] } } }), { status: 200 }),
			)
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ data: { Page: { media: [animeResult] } } }), { status: 200 }),
			);

		const results = await recommendMedia({
			type: "anime",
			preferences: "fantasy with an isekai plot",
		});

		expect(results).toHaveLength(1);
		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)).variables).toEqual({
			page: 1,
			perPage: 20,
			genreIn: ["Fantasy"],
		});
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
				url: "https://www.themoviedb.org/movie/42",
				summary: "A test movie.",
				year: 2024,
				rating: 8.1,
				genres: ["Science fiction"],
				poster: "https://image.tmdb.org/t/p/w500/poster.jpg",
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
				url: "https://www.themoviedb.org/tv/55",
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
