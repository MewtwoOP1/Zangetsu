import { clearRecommendationCooldowns, parseRecommendationRequest } from "../../../src/events/message/recommendation.event";

describe("parseRecommendationRequest", () => {
	it.each([
		["Can you recommend me a fantasy anime?", "anime"],
		["Any movie recommendations for a sci-fi fan?", "movie"],
		["Suggest a good TV series to watch", "series"],
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
