import { categoryColour, theme } from "@config/theme";
import { botName } from "@core/brand";
import { embed, errorEmbed, refusalEmbed, successEmbed, withPageFooter } from "@lib/discord/embeds.util";

describe("embed", () => {
	/** Read from the registry rather than spelled out, so repainting a category is not also a test edit. */
	it("colours by category", () => {
		expect(embed({ category: "economy" }).data.color).toBe(embed({ colour: categoryColour("economy") }).data.color);
	});

	it("prefers an explicit colour over the category", () => {
		const built = embed({ category: "economy", colour: "Red" });
		expect(built.data.color).toBe(embed({ colour: "Red" }).data.color);
	});

	it("always sets a footer, because Discord rejects an empty one", () => {
		expect(embed({}).data.footer?.text).toBe(`${botName()} • zangetsu.online`);
		expect(embed({ footer: "" }).data.footer?.text).toBe(`${botName()} • zangetsu.online`);
		expect(embed({ footer: "Page 1" }).data.footer?.text).toBe("Page 1 • zangetsu.online");
	});

	it("uses the shared Zangetsu banner on every embed and the logo as its default thumbnail", () => {
		const built = embed({});
		expect(built.data.footer?.icon_url).toBe(theme.logoUrl);
		expect(built.data.thumbnail?.url).toBe(theme.logoUrl);
		expect(built.data.image?.url).toBe(theme.bannerUrl);
	});

	it("keeps a command-provided image as the thumbnail while preserving the shared banner", () => {
		const built = embed({ image: "https://example.com/poster.png" });
		expect(built.data.image?.url).toBe(theme.bannerUrl);
		expect(built.data.thumbnail?.url).toBe("https://example.com/poster.png");
	});

	it("preserves an explicit thumbnail and still applies the shared banner", () => {
		const built = embed({ thumbnail: "https://example.com/custom.png" });
		expect(built.data.thumbnail?.url).toBe("https://example.com/custom.png");
		expect(built.data.image?.url).toBe(theme.bannerUrl);
	});

	it("allows a caller to override or suppress the default footer icon", () => {
		expect(embed({ footerIcon: "https://example.com/custom.png" }).data.footer?.icon_url).toBe(
			"https://example.com/custom.png",
		);
		expect(embed({ footerIcon: "" }).data.footer?.icon_url).toBeUndefined();
	});

	it("clamps a description Discord would reject", () => {
		const built = embed({ description: "x".repeat(5_000) });
		expect(built.data.description?.length).toBeLessThanOrEqual(4_096);
	});

	it("clamps field names and values", () => {
		const built = embed({ fields: [{ name: "n".repeat(400), value: "v".repeat(2_000) }] });
		expect(built.data.fields?.[0]?.name.length).toBeLessThanOrEqual(256);
		expect(built.data.fields?.[0]?.value.length).toBeLessThanOrEqual(1_024);
	});

	it("omits the author when none was given", () => {
		expect(embed({}).data.author).toBeUndefined();
	});

	it("can turn the timestamp off", () => {
		expect(embed({ timestamp: false }).data.timestamp).toBeUndefined();
		expect(embed({}).data.timestamp).toBeDefined();
	});
});

describe("the shorthand embeds", () => {
	it("prefixes an error with the error emoji", () => {
		expect(errorEmbed("Nope.").data.description).toBe(`${theme.emoji.error} Nope.`);
	});

	it("prefixes a success with the tick", () => {
		expect(successEmbed("Done.").data.description).toBe(`${theme.emoji.success} Done.`);
	});
});

describe("withPageFooter", () => {
	it("adds the page counter", () => {
		expect(withPageFooter(embed({ footer: "" }), 1, 5).data.footer?.text).toContain("Page 2 of 5");
	});

	it("keeps whatever footer was already there", () => {
		const built = withPageFooter(embed({ footer: "12 items" }), 0, 3);
		expect(built.data.footer?.text).toBe("Page 1 of 3 • 12 items • zangetsu.online");
	});
});

describe("refusalEmbed", () => {
	it("keeps a plain refusal as an error", () => {
		expect(refusalEmbed("Nope.").data.description).toBe(`${theme.emoji.error} Nope.`);
	});

	it("gives a titled refusal its own heading and no error cross", () => {
		const data = refusalEmbed({ title: "Under maintenance", message: "Back later." }).data;

		expect(data.title).toBe("Under maintenance");
		expect(data.description).toBe("Back later.");
	});
});
