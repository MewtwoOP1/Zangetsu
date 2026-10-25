import {
	clearRecommendationCooldowns,
	parseRecommendationRequest,
	parseRecommendationTypeChoice,
	stripBotMention,
} from "@events/message/recommendation.event";

describe("parseRecommendationTypeChoice", () => {
	it.each([
		["anime", "anime"],
		["anime please", "anime"],
		["manga", "manga"],
		["manhwa", "manga"],
		["light novel", "novel"],
		["web novel", "novel"],
		["movie", "movie"],
		["I want a movie", "movie"],
		["films!", "movie"],
		["TV series", "series"],
		["shows.", "series"],
		["all media", "all"],
	] as const)("parses the follow-up type %s", (value, expected) => {
		expect(parseRecommendationTypeChoice(value)).toBe(expected);
	});

	it("rejects text that is not a standalone media type", () => {
		expect(parseRecommendationTypeChoice("I like anime")).toBeNull();
	});
});

describe("stripBotMention", () => {
	const botId = "111111111111111111";

	it("removes this bot's leading mention from a natural-language request", () => {
		const text = stripBotMention(`<@${botId}> recommend me some anime`, botId);
		expect(text).toBe("recommend me some anime");
		expect(parseRecommendationRequest(text)?.type).toBe("anime");
	});

	it("supports Discord's nickname-mention form and leaves other mentions alone", () => {
		expect(stripBotMention(`<@!${botId}> recommend me some anime`, botId)).toBe("recommend me some anime");
		expect(stripBotMention("<@222222222222222222> recommend me some anime", botId)).toBe(
			"<@222222222222222222> recommend me some anime",
		);
	});
});

describe("parseRecommendationRequest", () => {
	it.each([
		["recommend me a fantasy anime?", "anime"],
		["recommend a sci-fi movie", "movie"],
		["suggest a good TV series to watch", "series"],
		["recommend anime and movies", "all"],
		["recommend manga and light novels", "all"],
		["recommend me a manhwa", "manga"],
		["suggest a slow burn romance manga", "manga"],
		["suggest me a fantasy light novel", "novel"],
		["suggest me an MC with no emotions who becomes a demon lord", "anime"],
		["recommend an MC that reincarnates and builds a kingdom", "anime"],
		["suggest something good", "anime"],
	] as const)("detects a %s request", (message, type) => {
		expect(parseRecommendationRequest(message)).toEqual({
			type,
			preferences: message.slice(0, 1_000),
		});
	});

	it("requires suggest or recommend at the beginning of a message", () => {
		expect(parseRecommendationRequest("I recommend you watch this anime")).toBeNull();
		expect(parseRecommendationRequest("Can you recommend me a fantasy anime?")).toBeNull();
		expect(parseRecommendationRequest("I have a suggestion about this manga")).toBeNull();
	});

	it("accepts long, free-form preferences up to the request limit", () => {
		const message = `Suggest me an MC ${"with a complicated backstory ".repeat(30)}`;
		expect(parseRecommendationRequest(message)?.type).toBe("anime");
		expect(parseRecommendationRequest(message)?.preferences).toBe(message);
		expect(parseRecommendationRequest(`recommend ${"a".repeat(1_500)}`)).toBeNull();
	});

	it("leaves a bare prefix available for the detail prompt", () => {
		expect(parseRecommendationRequest("suggest")).toEqual({ type: null, preferences: "suggest" });
	});

	it("ignores ordinary conversation and empty messages", () => {
		expect(parseRecommendationRequest("I watched a great anime yesterday")).toBeNull();
		expect(parseRecommendationRequest("")).toBeNull();
	});

	afterEach(() => {
		clearRecommendationCooldowns();
	});
});
