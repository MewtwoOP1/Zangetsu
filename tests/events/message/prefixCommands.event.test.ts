import { shouldDeferMentionRecommendation } from "@events/message/prefixCommands.event";

describe("shouldDeferMentionRecommendation", () => {
	it("lets natural-language recommendation mentions reach intent parsing", () => {
		expect(shouldDeferMentionRecommendation(null, "recommend")).toBe(true);
	});

	it("does not intercept regular prefixed commands", () => {
		expect(shouldDeferMentionRecommendation("t?", "recommend")).toBe(false);
		expect(shouldDeferMentionRecommendation("t?", "help")).toBe(false);
	});

	it("does not intercept other bot-mention commands or the rec alias", () => {
		expect(shouldDeferMentionRecommendation(null, "help")).toBe(false);
		expect(shouldDeferMentionRecommendation(null, "rec")).toBe(false);
	});
});
