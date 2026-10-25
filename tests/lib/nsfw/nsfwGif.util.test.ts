import {
	buildNsfwActionLine,
	buildRule34GifSearchUrl,
	parseRule34GifPosts,
	type NsfwGifCategory,
} from "@lib/nsfw/nsfwGif.util";

const basePost = {
	id: 12345,
	file_url: "https://img.rule34.xxx/images/12345/example.gif",
	rating: "explicit",
	tags: "animated fuck sex adult female_only",
};

describe("Rule34 hentai GIF provider", () => {
	it("attaches required API credentials to authenticated searches", () => {
		const url = new URL(
			buildRule34GifSearchUrl("gif", { apiKey: "test-api-key", userId: "1234567" }),
		);
		expect(url.searchParams.get("api_key")).toBe("test-api-key");
		expect(url.searchParams.get("user_id")).toBe("1234567");
	});

	it("requests explicit randomized animated media with adult-safety exclusions", () => {
		const url = new URL(buildRule34GifSearchUrl("fuck"));
		const tags = url.searchParams.get("tags") ?? "";

		expect(url.origin).toBe("https://api.rule34.xxx");
		expect(url.searchParams.get("page")).toBe("dapi");
		expect(url.searchParams.get("json")).toBe("1");
		expect(tags).toContain("rating:explicit");
		expect(tags).toContain("animated");
		expect(tags).toContain("sort:random");
		expect(tags).toContain("fuck");
		expect(tags).toContain("-loli");
		expect(tags).toContain("-underage");
		expect(tags).toContain("-rape");
	});

	it("accepts only explicit animated GIF files with matching category tags", () => {
		const results = parseRule34GifPosts(
			[
				basePost,
				{ ...basePost, id: 12346, file_url: "https://img.rule34.xxx/images/clip.webm" },
				{ ...basePost, id: 12347, rating: "safe" },
				{ ...basePost, id: 12348, tags: "animated breasts adult" },
				{ ...basePost, id: 12349, tags: "animated sex loli" },
				{ ...basePost, id: 12350, file_url: "http://img.rule34.xxx/images/unsafe.gif" },
				{ ...basePost, id: 12351, file_url: "https://evil.example/file.gif" },
			],
			"fuck",
		);

		expect(results).toEqual([
			{
				id: "12345",
				fileUrl: "https://img.rule34.xxx/images/12345/example.gif",
				postUrl: "https://rule34.xxx/index.php?page=post&s=view&id=12345",
			},
		]);
	});

	it("rejects posts tagged with underage characters in broad and random searches", () => {
		const categories: NsfwGifCategory[] = ["gif", "random", "hentai"];
		for (const category of categories) {
			expect(
				parseRule34GifPosts([{ ...basePost, tags: "animated adult underage" }], category),
			).toEqual([]);
		}
	});

	it("maps aliases to their specific Rule34 action tags", () => {
		const cases: [NsfwGifCategory, string][] = [
			["blowjob", "blowjob"],
			["bj", "blowjob"],
			["boobjob", "boobjob"],
			["bz", "boobjob"],
			["anal", "anal"],
			["tits", "tits"],
			["hentai", "hentai"],
			["fuck", "fuck"],
		];

		for (const [category, expectedTag] of cases) {
			const url = new URL(buildRule34GifSearchUrl(category));
			const tags = url.searchParams.get("tags")?.split(/\s+/) ?? [];
			expect(tags).toContain(expectedTag);
			expect(
				parseRule34GifPosts(
					[{ ...basePost, tags: `animated ${expectedTag} adult` }],
					category,
				),
			).toHaveLength(1);
		}

		expect(parseRule34GifPosts([{ ...basePost, tags: "animated boobjob adult" }], "fuck")).toEqual([]);
		expect(parseRule34GifPosts([{ ...basePost, tags: "animated sex adult" }], "fuck")).toEqual([]);
	});

	it("formats action captions using the invoking user and selected target", () => {
		expect(buildNsfwActionLine("fuck", "Runner", "Target")).toBe("@Runner fucks @Target.");
		expect(buildNsfwActionLine("bj", "Runner", "Target")).toBe("@Runner gives a blowjob to @Target.");
		expect(buildNsfwActionLine("bz", "Runner", "Target")).toBe("@Runner does a boobjob for @Target.");
		expect(buildNsfwActionLine("fuck", "<@everyone>", "Target")).toBe("@everyone fucks @Target.");
	});

	it("returns an empty list for malformed or non-list API data", () => {
		expect(parseRule34GifPosts(null, "gif")).toEqual([]);
		expect(parseRule34GifPosts({ success: false }, "gif")).toEqual([]);
		expect(parseRule34GifPosts([{ id: 1, tags: "animated", rating: "explicit" }], "gif")).toEqual([]);
	});
});
