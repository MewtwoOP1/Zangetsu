import { ButtonBuilder } from "discord.js";
import { parseCustomId } from "@core/button";
import {
	changeMediaSession,
	clearMediaSessions,
	createMediaSession,
	type MediaRecommendation,
} from "@lib/recommendations";

const ownerId = "111111111111111111";

const anime: MediaRecommendation = {
	title: "Test Anime",
	url: "https://zangetsu.online/open/?s=zm&u=zm%3A%2Fanime%2Fmal%3A1&t=Test+Anime&y=a",
	summary: "A test fantasy anime.",
	year: 2024,
	rating: 8.5,
	genres: ["Fantasy"],
	poster: "https://example.com/anime.jpg",
	source: "AniList",
	mediaType: "anime",
	status: "FINISHED",
	format: "TV",
	episodes: 12,
	popularity: 12_000,
	favourites: 900,
	rank: 7,
	popularityRank: 21,
};

const movie: MediaRecommendation = {
	title: "Test Movie",
	url: "https://zangetsu.online/open/?s=zm&u=zm%3A%2F%2Fmovie%2Ftmdb%3A42&t=Test+Movie&y=m",
	summary: "A test sci-fi movie.",
	year: 2023,
	rating: 8.1,
	genres: ["Science fiction"],
	poster: null,
	source: "TMDB",
	mediaType: "movie",
	voteCount: 1_200,
	popularity: 42.5,
};

describe("interactive media sessions", () => {
	beforeEach(() => clearMediaSessions());

	it("renders one card and updates the same message to the next result", () => {
		const initial = createMediaSession({
			userId: ownerId,
			items: [anime, movie],
			mode: "recommendation",
		});

		expect(initial.embeds).toHaveLength(1);
		expect(initial.embeds[0]?.data.title).toContain("Anime  |  Test Anime");

		const openButton = initial.components[0]?.components[2] as ButtonBuilder;
		expect(openButton.data.label).toBe("Open in Zangetsu");
		expect(openButton.data.url).toBe(anime.url);

		const component = initial.components[0]?.components[0];
		expect(component).toBeInstanceOf(ButtonBuilder);
		const nextButton = component as ButtonBuilder;
		const parsed = parseCustomId(nextButton.data.custom_id ?? "");
		const sessionId = parsed.args[0];

		expect(parsed.id).toBe("mediaSession");
		expect(parsed.action).toBe("next");
		expect(sessionId).toBeDefined();

		const next = changeMediaSession(sessionId ?? "", ownerId, "next");
		expect(next.embeds).toHaveLength(1);
		expect(next.embeds[0]?.data.title).toContain("Movie  |  Test Movie");
	});

	it("exposes AniList ranking and TMDB vote statistics in the full-stats view", () => {
		const initial = createMediaSession({
			userId: ownerId,
			items: [anime, movie],
			mode: "recommendation",
		});
		const component = initial.components[0]?.components[0] as ButtonBuilder;
		const sessionId = parseCustomId(component.data.custom_id ?? "").args[0] ?? "";

		const stats = changeMediaSession(sessionId, ownerId, "stats");
		const fields = stats.embeds[0]?.data.fields ?? [];

		expect(fields).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: "🏆 AniList rank", value: "#7" }),
				expect.objectContaining({ name: "🔥 Popularity rank", value: "#21" }),
				expect.objectContaining({ name: "💗 Favorites", value: "900" }),
			]),
		);
	});

	it("does not let another user advance someone else's panel", () => {
		const initial = createMediaSession({
			userId: ownerId,
			items: [anime, movie],
			mode: "recommendation",
		});
		const component = initial.components[0]?.components[0] as ButtonBuilder;
		const sessionId = parseCustomId(component.data.custom_id ?? "").args[0] ?? "";

		expect(() => changeMediaSession(sessionId, "222222222222222222", "next")).toThrow("expired");
	});
});
