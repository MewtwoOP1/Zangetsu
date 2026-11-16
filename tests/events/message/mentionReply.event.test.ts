import { type Message, type User } from "discord.js";
import { deleteMemories, listMemories, saveMemory } from "@database/repositories/aiMemoryRepository";
import {
	channelAnswerCount,
	clearMentionAssistantState,
	mentionsBot,
	stripAssistantMention,
} from "@events/message/mentionReply.event";
import { askZangetsu } from "@lib/assistant/zangetsuAssistant.util";
import { createMockClient, createMockMessage, createMockUser } from "@tests/helpers/mocks";

jest.mock("@database/repositories/settingsRepository", () => ({
	getPrefix: jest.fn(() => Promise.resolve("t?")),
	getPrefixConfig: jest.fn(() => Promise.resolve({ prefix: "t?", isEnabled: true })),
}));

jest.mock("@database/repositories/aiMemoryRepository", () => ({
	listMemories: jest.fn(() => Promise.resolve([])),
	listAllMemories: jest.fn(() => Promise.resolve([])),
	countMemories: jest.fn(() => Promise.resolve(0)),
	findMemory: jest.fn(() => Promise.resolve(null)),
	saveMemory: jest.fn((input: unknown) =>
		Promise.resolve({
			...((input ?? {}) as Record<string, unknown>),
			memoryId: "m1",
			entities: [],
			relatedMemoryIds: [],
			sourceMessageId: null,
			sourceChannelId: null,
			version: 1,
			isActive: true,
			supersedesId: null,
			supersededById: null,
			accessCount: 0,
			lastAccessedAt: new Date(),
			createdAt: new Date(),
			updatedAt: new Date(),
		}),
	),
	deleteMemory: jest.fn(() => Promise.resolve(false)),
	deleteMemories: jest.fn(() => Promise.resolve(0)),
	clearMemoryCache: jest.fn(),
	findSimilarMemories: jest.fn(() => Promise.resolve([])),
	rememberMemories: jest.fn(),
	cachedMemories: jest.fn(() => null),
	touchMemories: jest.fn(() => Promise.resolve()),
	supersedeMemory: jest.fn(() => Promise.resolve()),
	linkSuperseding: jest.fn(() => Promise.resolve()),
	resetMemoryCache: jest.fn(),
}));

jest.mock("@lib/assistant/zangetsuAssistant.util", () => {
	const actual = jest.requireActual<Record<string, unknown>>("@lib/assistant/zangetsuAssistant.util");
	return { ...actual, askZangetsu: jest.fn(() => Promise.resolve("Open Settings, then Sources.")) };
});

const botId = "111111111111111111";
const memberId = "222222222222222222";
const ownerId = "333333333333333333";

describe("detecting a mention of this bot", () => {
	it("sees the bot in Discord's own mention list", () => {
		expect(mentionsBot("hey", botId, [botId])).toBe(true);
		expect(mentionsBot("hey", botId, [memberId])).toBe(false);
	});

	it("sees the bot in the raw mention Discord sends", () => {
		expect(mentionsBot(`<@${botId}> hello`, botId)).toBe(true);
		expect(mentionsBot(`<@!${botId}> hello`, botId)).toBe(true);
		expect(mentionsBot(`<@${memberId}> hello`, botId)).toBe(false);
	});

	it("does not mistake the word Zangetsu for a mention", () => {
		expect(mentionsBot("Zangetsu is a nice app", botId)).toBe(false);
		expect(mentionsBot("zangetsu", botId)).toBe(false);
	});
});

describe("removing the mention from the question", () => {
	it("removes the bot mention and preserves the actual question", () => {
		expect(stripAssistantMention(`<@${botId}> hi, what are you doing?`, botId)).toBe("hi, what are you doing?");
	});

	it("supports nickname mentions and leaves other users' mentions alone", () => {
		expect(stripAssistantMention(`<@!${botId}> hello <@${memberId}>`, botId)).toBe(`hello <@${memberId}>`);
	});
});

describe("the mention handler's own state", () => {
	beforeEach(() => {
		clearMentionAssistantState();
	});

	it("counts a channel's answers inside the window", () => {
		expect(channelAnswerCount("channel", Date.now())).toBe(0);
	});
});

describe("the mention handler", () => {
	let now = 1_000_000;

	beforeEach(() => {
		clearMentionAssistantState();
		jest.restoreAllMocks();
		now = 1_000_000;
		jest.spyOn(Date, "now").mockImplementation(() => now);
	});

	function mockMessage(
		content: string,
		overrides: Record<string, unknown> = {},
		mentions: User[] = [createMockUser({ id: memberId })],
	): Message & { sent: Record<string, unknown>[] } {
		return createMockMessage({
			content,
			mentions,
			overrides: { id: "message-1", author: mentions[0], ...overrides } as never,
		});
	}

	function mockClient(overrides: Record<string, unknown> = {}) {
		return createMockClient({
			user: { id: botId, displayAvatarURL: () => "https://cdn.example/avatar.png" },
			env: { DISCORD_OWNER_IDS: [ownerId], GROQ_API_KEY: "test-key" },
			...overrides,
		} as never);
	}

	it("does not answer a message that does not mention the bot", async () => {
		const handler = (await import("@events/message/mentionReply.event")).default;
		const message = mockMessage("just chatting about Zangetsu");

		await handler.run(message, mockClient());

		expect(message.reply).not.toHaveBeenCalled();
		expect(askZangetsu).not.toHaveBeenCalled();
	});

	it("does not answer a message the bot itself sent", async () => {
		const handler = (await import("@events/message/mentionReply.event")).default;
		const message = mockMessage(`<@${botId}> hello`, { author: { id: botId, bot: true } });

		await handler.run(message, mockClient());

		expect(message.reply).not.toHaveBeenCalled();
	});

	it("answers a mention as a reply to the message that asked", async () => {
		const handler = (await import("@events/message/mentionReply.event")).default;
		const message = mockMessage(`<@${botId}> how do I add a repository?`);

		await handler.run(message, mockClient());

		expect(message.reply).toHaveBeenCalledTimes(1);
		expect(String((message.reply as jest.Mock).mock.calls[0]?.[0]?.content)).toBe("Open Settings, then Sources.");
	});

	it("sends the question without the bot's mention in it", async () => {
		const handler = (await import("@events/message/mentionReply.event")).default;
		const message = mockMessage(`<@${botId}> how do I add a repository?`);

		await handler.run(message, mockClient());

		expect(askZangetsu).toHaveBeenCalledWith(expect.objectContaining({ question: "how do I add a repository?" }));
	});

	it("does not answer the same message twice", async () => {
		const handler = (await import("@events/message/mentionReply.event")).default;
		const message = mockMessage(`<@${botId}> how do I add a repository?`);

		await handler.run(message, mockClient());
		await handler.run(message, mockClient());

		expect(message.reply).toHaveBeenCalledTimes(1);
	});

	it("answers a bare mention with the introduction", async () => {
		const handler = (await import("@events/message/mentionReply.event")).default;
		const message = mockMessage(`<@${botId}>`);

		await handler.run(message, mockClient());

		expect(message.reply).toHaveBeenCalledTimes(1);
		expect(String((message.reply as jest.Mock).mock.calls[0]?.[0]?.content)).toContain("Mention me with a message");
		expect(askZangetsu).not.toHaveBeenCalled();
	});

	it("says so when Groq is not configured, without answering anything else", async () => {
		const handler = (await import("@events/message/mentionReply.event")).default;
		const message = mockMessage(`<@${botId}> how do I add a repository?`);

		await handler.run(message, mockClient({ env: { DISCORD_OWNER_IDS: [ownerId] } }));

		expect(String((message.reply as jest.Mock).mock.calls[0]?.[0]?.content)).toContain(
			"Groq connection is not configured",
		);
		expect(askZangetsu).not.toHaveBeenCalled();
	});

	it("does not answer a message that is really a prefix command", async () => {
		const handler = (await import("@events/message/mentionReply.event")).default;
		const client = mockClient();
		const command = { name: "help", description: "Help", category: "info" as const };
		client.commands.set("help", command);
		const message = mockMessage(`<@${botId}> t?help`);

		await handler.run(message, client);

		expect(message.reply).not.toHaveBeenCalled();
	});

	it("leaves a recommendation request to the recommendation handler", async () => {
		const handler = (await import("@events/message/mentionReply.event")).default;
		const message = mockMessage(`<@${botId}> suggest some quiet anime`);

		await handler.run(message, mockClient());

		expect(message.reply).not.toHaveBeenCalled();
		expect(askZangetsu).not.toHaveBeenCalled();
	});

	it("answers a reply to its own answer as a continuation", async () => {
		const handler = (await import("@events/message/mentionReply.event")).default;
		const first = mockMessage(`<@${botId}> how do I add a repository?`, { id: "first" });
		await handler.run(first, mockClient());

		now += 30_000;
		const second = mockMessage("What about Android TV?", {
			id: "second",
			reference: { messageId: "reply" },
		});

		await handler.run(second, mockClient());

		expect(askZangetsu).toHaveBeenCalledTimes(2);
		expect(askZangetsu).toHaveBeenLastCalledWith(expect.objectContaining({ question: "What about Android TV?" }));
	});

	it("does not treat another member's question as a continuation of mine", async () => {
		const handler = (await import("@events/message/mentionReply.event")).default;
		const first = mockMessage(`<@${botId}> how do I add a repository?`, { id: "first" });
		await handler.run(first, mockClient());

		now += 30_000;
		const other = createMockUser({ id: "444444444444444444" });
		const second = mockMessage("What about Android TV?", { id: "second", reference: { messageId: "reply" } }, [other]);

		await handler.run(second, mockClient());

		expect(askZangetsu).toHaveBeenCalledTimes(1);
	});

	it("waits rather than answering twice in a row", async () => {
		const handler = (await import("@events/message/mentionReply.event")).default;
		const first = mockMessage(`<@${botId}> how do I add a repository?`, { id: "first" });
		await handler.run(first, mockClient());

		now += 1_000;
		const second = mockMessage(`<@${botId}> and the tv?`, { id: "second" });
		await handler.run(second, mockClient());

		expect(askZangetsu).toHaveBeenCalledTimes(1);
	});

	it("answers 'help me' as a question rather than printing the command list", async () => {
		const handler = (await import("@events/message/mentionReply.event")).default;
		const client = mockClient();
		client.commands.set("help", { name: "help", description: "Help", category: "info" });
		const message = mockMessage(`<@${botId}> help me`);

		await handler.run(message, client);

		expect(askZangetsu).toHaveBeenCalledTimes(1);
		expect(askZangetsu).toHaveBeenLastCalledWith(expect.objectContaining({ question: "help me" }));
	});

	it("delivers a long answer as one reply and then plain channel messages", async () => {
		jest.mocked(askZangetsu).mockResolvedValueOnce("word ".repeat(900));
		const handler = (await import("@events/message/mentionReply.event")).default;
		const message = mockMessage(`<@${botId}> tell me everything`);

		await handler.run(message, mockClient());

		const channel = message.channel as unknown as { send: jest.Mock };
		expect(message.reply).toHaveBeenCalledTimes(1);
		expect(channel.send).toHaveBeenCalledTimes(2);

		const sent = [
			String((message.reply as jest.Mock).mock.calls[0]?.[0]?.content),
			...channel.send.mock.calls.map((call: unknown[]) => String((call[0] as { content: string }).content)),
		];
		expect(sent.join(" ").replace(/\s+/g, " ").trim()).toBe("word ".repeat(900).replace(/\s+/g, " ").trim());
		for (const content of sent) expect(content.length).toBeLessThanOrEqual(2_000);
	});

	it("never schedules a deletion for an answer that shared the repository link", async () => {
		jest.mocked(askZangetsu).mockResolvedValueOnce("The source is at https://github.com/Spyou/Zangetsu.");
		const handler = (await import("@events/message/mentionReply.event")).default;
		const client = mockClient();
		const message = mockMessage(`<@${botId}> where is the source?`);

		await handler.run(message, client);

		expect(String((message.reply as jest.Mock).mock.calls[0]?.[0]?.content)).toContain("github.com");
		expect(client.timers.after).not.toHaveBeenCalledWith(
			expect.stringContaining("source-share"),
			expect.any(Number),
			expect.any(Function),
		);
		expect(message.delete).not.toHaveBeenCalled();
	});

	it("tells the model what it remembers about this person", async () => {
		jest.mocked(listMemories).mockResolvedValue([
			{
				memoryId: "m1",
				userId: memberId,
				guildId: null,
				scope: "user",
				category: "preference",
				memoryType: "preference",
				content: "likes Build series anime",
				summary: "likes Build series anime",
				entities: [],
				relatedMemoryIds: [],
				sourceMessageId: null,
				sourceChannelId: null,
				confidence: 0.9,
				importance: 0.8,
				explicitlyRequested: true,
				sensitivity: "normal",
				version: 1,
				isActive: true,
				supersedesId: null,
				supersededById: null,
				accessCount: 0,
				lastAccessedAt: new Date(),
				createdAt: new Date(),
				updatedAt: new Date(),
			},
		]);
		const handler = (await import("@events/message/mentionReply.event")).default;
		const message = mockMessage(`<@${botId}> what should I watch next`);

		await handler.run(message, mockClient());

		const call = jest.mocked(askZangetsu).mock.calls.at(-1)?.[0];
		expect(call?.memoryBlock).toContain("likes Build series anime");
	});

	it("tells the model which mood the message earned", async () => {
		const handler = (await import("@events/message/mentionReply.event")).default;
		const message = mockMessage(`<@${botId}> you're so cute`);

		await handler.run(message, mockClient());

		const call = jest.mocked(askZangetsu).mock.calls.at(-1)?.[0];
		expect(call?.mood?.mood).toBe("shy");
	});

	it("remembers what somebody asked it to remember, without asking the model", async () => {
		const handler = (await import("@events/message/mentionReply.event")).default;
		const message = mockMessage(`<@${botId}> remember that my name is Riku`);

		await handler.run(message, mockClient());

		expect(saveMemory).toHaveBeenCalledWith(expect.objectContaining({ content: "my name is Riku" }));
		expect(askZangetsu).not.toHaveBeenCalled();
		expect(String((message.reply as jest.Mock).mock.calls[0]?.[0]?.content)).toContain("remember that");
	});

	it("does not keep a reminder to do something as a fact", async () => {
		const handler = (await import("@events/message/mentionReply.event")).default;
		const message = mockMessage(`<@${botId}> don't forget to bring milk`);

		await handler.run(message, mockClient());

		expect(saveMemory).not.toHaveBeenCalled();
		expect(askZangetsu).toHaveBeenCalledTimes(1);
	});

	it("forgets everything when somebody asks it to", async () => {
		const handler = (await import("@events/message/mentionReply.event")).default;
		const message = mockMessage(`<@${botId}> forget everything you know about me`);

		await handler.run(message, mockClient());

		expect(deleteMemories).toHaveBeenCalledWith(memberId);
		expect(askZangetsu).not.toHaveBeenCalled();
	});

	it("reads the exchange afterwards so the next conversation remembers it", async () => {
		const handler = (await import("@events/message/mentionReply.event")).default;
		const client = mockClient();
		const message = mockMessage(`<@${botId}> I am learning Rust this year`);

		await handler.run(message, client);

		expect(client.timers.after).toHaveBeenCalledWith("memory-extraction", expect.any(Number), expect.any(Function));
	});
});
