import { shouldDeferRecommendationToIntent } from "@events/message/prefixCommands.event";

describe("shouldDeferRecommendationToIntent", () => {
	it("routes natural-language recommendation phrasing through intent parsing", () => {
		expect(shouldDeferRecommendationToIntent("recommend", ["me", "some", "anime"])).toBe(true);
		expect(shouldDeferRecommendationToIntent("recommend", [])).toBe(true);
		expect(shouldDeferRecommendationToIntent("recommend", ["film"])).toBe(true);
	});

	it("preserves explicit type-first commands", () => {
		expect(shouldDeferRecommendationToIntent("recommend", ["anime", "fantasy"])).toBe(false);
		expect(shouldDeferRecommendationToIntent("recommend", ["movie", "romance"])).toBe(false);
		expect(shouldDeferRecommendationToIntent("recommend", ["series", "sci-fi"])).toBe(false);
	});

	it("does not intercept other commands or the rec alias", () => {
		expect(shouldDeferRecommendationToIntent("help", ["recommend"])).toBe(false);
		expect(shouldDeferRecommendationToIntent("rec", ["me", "some", "anime"])).toBe(false);
	});
});
