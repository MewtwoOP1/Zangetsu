import { EmbedBuilder } from "discord.js";
import { embed } from "@lib/discord/embeds.util";
import {
	clearCommandBannerCache,
	commandBannerBuffer,
	commandBannerLabel,
	withCommandBannerPayload,
} from "@lib/canvas/commandBanner.util";

describe("command banners", () => {
	beforeEach(() => {
		clearCommandBannerCache();
		jest.spyOn(global, "fetch").mockRejectedValue(new Error("CDN unavailable"));
	});

	afterEach(() => jest.restoreAllMocks());

	it("normalizes command names for the banner label", () => {
		expect(commandBannerLabel(" community   recommend ")).toBe("/community recommend");
		expect(commandBannerLabel("/PING")).toBe("/ping");
	});

	it("renders a small cached JPEG even if the remote logo cannot be fetched", async () => {
		const first = await commandBannerBuffer("/recommend");
		const second = await commandBannerBuffer("/recommend");

		expect(first.subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
		expect(first.length).toBeLessThan(150_000);
		expect(second).toBe(first);
	});

	it("adds the banner attachment to embed replies but leaves text-only replies untouched", async () => {
		const options = { embeds: [embed({ title: "Example" })] };
		const branded = await withCommandBannerPayload(options, "/example");

		expect((branded.embeds?.[0] as EmbedBuilder).data.image?.url).toBe("attachment://zangetsu-command-banner.jpg");
		expect(branded.files).toHaveLength(1);
		expect(await withCommandBannerPayload("plain text", "/example")).toBe("plain text");
	});

	it("keeps custom artwork as the thumbnail while using the command banner as the main image", async () => {
		const branded = await withCommandBannerPayload(
			{ embeds: [embed({ image: "https://example.com/custom.jpg" })] },
			"/art",
		);
		const data = (branded.embeds?.[0] as EmbedBuilder).data;

		expect(data.image?.url).toBe("attachment://zangetsu-command-banner.jpg");
		expect(data.thumbnail?.url).toBe("https://example.com/custom.jpg");
	});
});
