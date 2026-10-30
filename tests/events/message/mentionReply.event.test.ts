import { stripAssistantMention } from "@events/message/mentionReply.event";

describe("stripAssistantMention", () => {
	const botId = "111111111111111111";

	it("removes the bot mention and preserves the actual question", () => {
		expect(stripAssistantMention(`<@${botId}> hi, what are you doing?`, botId)).toBe(
			"hi, what are you doing?",
		);
	});

	it("supports nickname mentions and leaves other users' mentions alone", () => {
		expect(stripAssistantMention(`<@!${botId}> hello <@222222222222222222>`, botId)).toBe(
			"hello <@222222222222222222>",
		);
	});
});
