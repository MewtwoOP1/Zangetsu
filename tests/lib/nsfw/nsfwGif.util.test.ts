import {
	buildNsfwActionLine,
	buildWaifuGifSearchUrl,
	parseWaifuGifImages,
	type NsfwGifCategory,
} from "@lib/nsfw/nsfwGif.util";

const baseImage = {
	id: 12345,
	url: "https://cdn.waifu.im/?file=adult-example.gif",
	extension: "gif",
	is_nsfw: true,
	source: "https://www.waifu.im/",
	tags: [{ name: "hentai" }, { name: "adult" }],
};

describe("Waifu API NSFW GIF provider", () => {
	it("requests animated NSFW images from the current community API", () => {
		const url = new URL(buildWaifuGifSearchUrl("ass"));
		expect(url.origin).toBe("https://waifu-api-031n.onrender.com");
		expect(url.pathname).toBe("/images");
		expect(url.searchParams.get("isNsfw")).toBe("True");
		expect(url.searchParams.get("isAnimated")).toBe("True");
		expect(url.searchParams.get("orderBy")).toBe("Random");
		expect(url.searchParams.get("pageSize")).toBe("30");
		expect(url.searchParams.getAll("includedTags")).toContain("ass");
		expect(url.searchParams.getAll("excludedTags")).toEqual([]);
	});

	it("supports API instances mounted beneath a path prefix", () => {
		const url = new URL(buildWaifuGifSearchUrl("random", true, "https://api.example.com/api"));
		expect(url.origin).toBe("https://api.example.com");
		expect(url.pathname).toBe("/api/images");
	});

	it("maps category aliases to the fork's archive tags", () => {
		const cases: [NsfwGifCategory, string][] = [
			["blowjob", "oral"],
			["bj", "oral"],
			["boobjob", "paizuri"],
			["bz", "paizuri"],
			["tits", "oppai"],
			["ass", "ass"],
			["hentai", "hentai"],
		];
		for (const [category, tag] of cases) {
			expect(new URL(buildWaifuGifSearchUrl(category)).searchParams.getAll("includedTags")).toContain(tag);
		}
		expect(new URL(buildWaifuGifSearchUrl("gif")).searchParams.getAll("includedTags")).toEqual([]);
		expect(new URL(buildWaifuGifSearchUrl("random")).searchParams.getAll("includedTags")).toEqual([]);
	});

	it("supports a general catalogue retry without category tags", () => {
		const url = new URL(buildWaifuGifSearchUrl("fuck", false));
		expect(url.searchParams.getAll("includedTags")).toEqual([]);
		expect(url.searchParams.get("isNsfw")).toBe("True");
		expect(url.searchParams.get("isAnimated")).toBe("True");
	});

	it("accepts only HTTPS GIFs explicitly marked NSFW and rejects excluded tags", () => {
		const results = parseWaifuGifImages({
			items: [
				baseImage,
				{ ...baseImage, id: 2, is_nsfw: false },
				{ ...baseImage, id: 3, url: "https://cdn.waifu.im/not-a-gif.jpg", extension: "jpg" },
				{ ...baseImage, id: 4, url: "http://cdn.waifu.im/file.gif" },
				{ ...baseImage, id: 5, url: "https://user:pass@example.com/file.gif" },
				{ ...baseImage, id: 6, isAnimated: false },
				{ ...baseImage, id: 7, tags: [{ name: "loli" }] },
				{ ...baseImage, id: 8, tags: [{ name: "rape" }] },
			],
			totalCount: 8,
		});
		expect(results).toEqual([
			{
				id: "12345",
				fileUrl: "https://cdn.waifu.im/?file=adult-example.gif",
				postUrl: "https://www.waifu.im/",
			},
		]);
	});

	it("accepts the new fork's camel-case fields, items array, and separate CDN", () => {
		expect(
			parseWaifuGifImages({
				items: [
					{
						id: 987,
						url: "https://waifu-cdn.waifu-api.workers.dev/987.gif",
						extension: ".gif",
						isNsfw: true,
						isAnimated: true,
						source: null,
						tags: [{ name: "hentai" }],
					},
				],
				totalCount: 1,
			}),
		).toEqual([
			{
				id: "987",
				fileUrl: "https://waifu-cdn.waifu-api.workers.dev/987.gif",
				postUrl: "https://waifu-cdn.waifu-api.workers.dev/987.gif",
			},
		]);
	});

	it("supports older array-based response wrappers and malformed payloads", () => {
		expect(parseWaifuGifImages([{ ...baseImage, is_nsfw: undefined, isNsfw: true }])).toHaveLength(1);
		expect(parseWaifuGifImages({ data: [baseImage] })).toHaveLength(1);
		expect(parseWaifuGifImages({ images: "bad" })).toEqual([]);
		expect(parseWaifuGifImages(null)).toEqual([]);
	});

	it("uses user mention markup while retaining the action", () => {
		expect(buildNsfwActionLine("fuck", "111111111111111111", "222222222222222222"))
			.toBe("<@111111111111111111> fucks <@222222222222222222>.");
		expect(buildNsfwActionLine("bj", "111111111111111111", "222222222222222222"))
			.toBe("<@111111111111111111> gives a blowjob to <@222222222222222222>.");
		expect(buildNsfwActionLine("bz", "111111111111111111", "222222222222222222"))
			.toBe("<@111111111111111111> does a boobjob for <@222222222222222222>.");
		expect(buildNsfwActionLine("fuck", "@everyone", "Target")).toBe("@user fucks @user.");
	});
});
