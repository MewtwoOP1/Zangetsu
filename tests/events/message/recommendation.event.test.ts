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
		["Can you recommend me a fantasy anime?", "anime"],
		["Any movie recommendations for a sci-fi fan?", "movie"],
		["Suggest a good TV series to watch", "series"],
		["Recommend anime and movies", "all"],
		["What anime should I watch next?", "anime"],
	] as const)("detects a %s request", (message, type) => {
		expect(parseRecommendationRequest(message)).toEqual({
			type,
			preferences: message.slice(0, 250),
		});
	});

	it("asks for a media type when the request does not specify one", () => {
		expect(parseRecommendationRequest("Can you recommend something good to watch?")).toEqual({
			type: null,
			preferences: "Can you recommend something good to watch?",
		});
	});

	it("ignores ordinary conversation and empty or oversized messages", () => {
		expect(parseRecommendationRequest("I watched a great anime yesterday")).toBeNull();
		expect(parseRecommendationRequest("")).toBeNull();
		expect(parseRecommendationRequest("recommend anime ".padEnd(1_501, "a"))).toBeNull();
	});

	afterEach(() => {
		clearRecommendationCooldowns();
	});
});
