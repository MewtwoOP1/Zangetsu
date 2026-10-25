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

describe("Waifu.im hentai GIF provider", () => {
	it("requests NSFW animated GIFs from the configured worker", () => {
		const url = new URL(buildWaifuGifSearchUrl("ass"));
		expect(url.origin).toBe("https://api.waifu-im.workers.dev");
		expect(url.pathname).toBe("/search");
		expect(url.searchParams.get("is_nsfw")).toBe("true");
		expect(url.searchParams.get("gif")).toBe("true");
		expect(url.searchParams.get("many")).toBe("true");
		expect(url.searchParams.get("order_by")).toBe("RANDOM");
		expect(url.searchParams.getAll("included_tags")).toContain("ass");
		expect(url.searchParams.getAll("excluded_tags")).toContain("underage");
		expect(url.searchParams.getAll("excluded_tags")).toContain("rape");
	});

	it("maps category aliases to Waifu.im archive tags", () => {
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
			expect(new URL(buildWaifuGifSearchUrl(category)).searchParams.getAll("included_tags")).toContain(tag);
		}
		expect(new URL(buildWaifuGifSearchUrl("gif")).searchParams.getAll("included_tags")).toEqual([]);
		expect(new URL(buildWaifuGifSearchUrl("random")).searchParams.getAll("included_tags")).toEqual([]);
	});

	it("supports a general catalogue retry without category tags", () => {
		const url = new URL(buildWaifuGifSearchUrl("fuck", false));
		expect(url.searchParams.getAll("included_tags")).toEqual([]);
		expect(url.searchParams.get("is_nsfw")).toBe("true");
		expect(url.searchParams.get("gif")).toBe("true");
	});

	it("accepts only HTTPS GIFs explicitly marked NSFW", () => {
		const results = parseWaifuGifImages({
			images: [
				baseImage,
				{ ...baseImage, id: 2, is_nsfw: false },
				{ ...baseImage, id: 3, url: "https://cdn.waifu.im/not-a-gif.jpg", extension: "jpg" },
				{ ...baseImage, id: 4, url: "http://cdn.waifu.im/file.gif" },
				{ ...baseImage, id: 5, url: "https://example.com/file.gif" },
				{ ...baseImage, id: 6, tags: [{ name: "loli" }] },
				{ ...baseImage, id: 7, tags: [{ name: "rape" }] },
			],
		});
		expect(results).toEqual([
			{
				id: "12345",
				fileUrl: "https://cdn.waifu.im/?file=adult-example.gif",
				postUrl: "https://www.waifu.im/",
			},
		]);
	});

	it("supports camel-case NSFW fields and array-based responses", () => {
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
