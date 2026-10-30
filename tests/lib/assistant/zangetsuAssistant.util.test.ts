import {
	askZangetsu,
	buildZangetsuSystemPrompt,
	cleanAssistantReply,
	formatAssistantReply,
	isRomanticAdvance,
	trimAssistantHistory,
	ZANGETSU_ASSISTANT_LIMITS,
} from "@lib/assistant/zangetsuAssistant.util";

describe("Zangetsu assistant knowledge", () => {
	it("defines one shared girlfriend persona and one configured boyfriend", () => {
		const prompt = buildZangetsuSystemPrompt("12345678901234567", "22345678901234567");
		expect(prompt).toContain("fictional adult anime-girl companion");
		expect(prompt).toContain("Do NOT mention the owner's name");
		expect(prompt).toContain("Never prepend a relationship disclaimer");
		expect(prompt).toContain("playfully savage");
		expect(prompt).toContain("drop sarcasm for distress");
		expect(prompt).toContain("No spammed");
		expect(prompt).toContain("The one and only boyfriend is the bot owner, Discord ID 12345678901234567");
		expect(prompt).toContain("Every other person is a server member/friend");
		expect(prompt).toContain("is a server member/friend, not your boyfriend");
		expect(prompt).toContain("one consistent voice with EVERYONE");
		expect(buildZangetsuSystemPrompt("12345678901234567", "12345678901234567")).toContain("is your boyfriend. Address him with natural affection");
	});

	it("explicitly excludes source-repository names, lists, and links", () => {
		const prompt = buildZangetsuSystemPrompt("12345678901234567", "22345678901234567");
		expect(prompt).toContain("never name, list, recommend, rank, or link source repositories");
		expect(prompt).not.toContain("github.com/");
		expect(prompt).not.toContain("MewtwoOP1");
	});

	it("clips conversation history to the most recent four messages", () => {
		const history = Array.from({ length: 14 }, (_, index) => ({
			role: index % 2 === 0 ? "user" as const : "assistant" as const,
			content: `turn-${index}`,
		}));

		expect(trimAssistantHistory(history)).toEqual(history.slice(-4));
		expect(trimAssistantHistory(history)).toHaveLength(ZANGETSU_ASSISTANT_LIMITS.historyMessages);
		expect(ZANGETSU_ASSISTANT_LIMITS.historyMessages).toBe(4);
		expect(ZANGETSU_ASSISTANT_LIMITS.historyChars).toBe(600);
		expect(ZANGETSU_ASSISTANT_LIMITS.questionChars).toBe(1_000);
		expect(ZANGETSU_ASSISTANT_LIMITS.replyChars).toBe(1_600);
		expect(ZANGETSU_ASSISTANT_LIMITS.completionTokens).toBe(320);
	});

	it("limits long history messages and strips source-repository URLs from replies", () => {
		expect(trimAssistantHistory([{ role: "user", content: "x".repeat(2_000) }])[0]?.content).toHaveLength(
			ZANGETSU_ASSISTANT_LIMITS.historyChars,
		);
		expect(cleanAssistantReply("Try this https://github.com/example/source for more")).toContain(
			"[source-repository link omitted]",
		);
	});
	it("mentions the owner only for explicit romantic advances from members", () => {
		const ownerId = "12345678901234567";
		const memberId = "22345678901234567";
		expect(isRomanticAdvance("I love you so much!", memberId, ownerId)).toBe(true);
		expect(isRomanticAdvance("Are you single?", memberId, ownerId)).toBe(true);
		expect(isRomanticAdvance("You're so cute", memberId, ownerId)).toBe(false);
		expect(isRomanticAdvance("How are you today?", memberId, ownerId)).toBe(false);
		expect(isRomanticAdvance("I love you", ownerId, ownerId)).toBe(false);
		expect(formatAssistantReply("Aww, that's sweet.", ownerId, false)).toBe("Aww, that's sweet.");
		expect(formatAssistantReply("Aww, that's sweet.", ownerId, true)).toBe(
			"Aww, that's sweet.\n\nI'm already taken — <@12345678901234567>'s my boyfriend.",
		);
	});

	it("removes accidental owner claims and duplicate owner mentions from model output", () => {
		const messy = "I'm <@12345678901234567>'s girlfriend, obviously. You are <@12345678901234567>'s girlfriend.\nHey hun! How are you?";
		expect(cleanAssistantReply(messy, "12345678901234567")).toBe("Hey hun! How are you?");
	});

});

describe("askZangetsu", () => {
	afterEach(() => jest.restoreAllMocks());

	it("uses the existing Groq key and configured recommendation model for conversational replies", async () => {
		const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
			new Response(JSON.stringify({
				choices: [{ message: { content: "Just chatting with the community. What about you?" } }],
			}), { status: 200, headers: { "content-type": "application/json" } }),
		);

		await expect(askZangetsu({
			question: "How do I switch servers in the Zangetsu player?",
			history: [{ role: "user", content: "hi" }, { role: "assistant", content: "Hey!" }],
			apiKey: "test-groq-key",
			ownerId: "12345678901234567",
			speakerId: "22345678901234567",
			model: "openai/gpt-oss-20b",
		})).resolves.toBe("Just chatting with the community. What about you?");

		expect(fetchMock).toHaveBeenCalledWith(
			"https://api.groq.com/openai/v1/chat/completions",
			expect.objectContaining({
				method: "POST",
				headers: expect.objectContaining({ Authorization: "Bearer test-groq-key" }),
				signal: expect.any(AbortSignal),
			}),
		);
		const payload = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
		expect(payload.model).toBe("openai/gpt-oss-20b");
		expect(payload.max_completion_tokens).toBe(320);
		expect(payload.temperature).toBe(0.8);
		expect(payload.messages[0].role).toBe("system");
		expect(payload.messages[0].content).toContain("mpv playback");
		expect(payload.messages[0].content).toContain("Android TV");
		expect(payload.messages.at(-3)).toEqual({ role: "user", content: "hi" });
		expect(payload.messages.at(-1)).toEqual({ role: "user", content: "How do I switch servers in the Zangetsu player?" });
	});

	it("omits the product knowledge block for casual chats to save input tokens", async () => {
		jest.spyOn(global, "fetch").mockResolvedValue(
			new Response(JSON.stringify({ choices: [{ message: { content: "Not much, just here." } }] }), {
				status: 200, headers: { "content-type": "application/json" },
			}),
		);
		await askZangetsu({ question: "What are you doing?", ownerId: "12345678901234567", speakerId: "22345678901234567", apiKey: "test-key" });
		const payload = JSON.parse(String(jest.mocked(global.fetch).mock.calls[0]?.[1]?.body));
		expect(payload.messages[0].content).not.toContain("mpv playback");
	});

	it("falls back to the Groq model when the legacy OpenRouter model is configured", async () => {
		jest.spyOn(global, "fetch").mockResolvedValue(
			new Response(JSON.stringify({ choices: [{ message: { content: "Hello." } }] }), {
				status: 200, headers: { "content-type": "application/json" },
			}),
		);

		await askZangetsu({
			question: "hi",
			ownerId: "12345678901234567",
			speakerId: "22345678901234567",
			apiKey: "test-key",
			model: "openrouter/auto",
		});
		const payload = JSON.parse(String(jest.mocked(global.fetch).mock.calls[0]?.[1]?.body));
		expect(payload.model).toBe("openai/gpt-oss-20b");
	});

	it("rejects empty questions, missing keys, and empty model responses", async () => {
		await expect(askZangetsu({ question: "  ", ownerId: "12345678901234567", speakerId: "22345678901234567", apiKey: "key" })).rejects.toThrow("needs a question");
		await expect(askZangetsu({ question: "hi", ownerId: "12345678901234567", speakerId: "22345678901234567", apiKey: "" })).rejects.toThrow("Groq is not configured");

		jest.spyOn(global, "fetch").mockResolvedValue(
			new Response(JSON.stringify({ choices: [{ message: { content: " " } }] }), {
				status: 200, headers: { "content-type": "application/json" },
			}),
		);
		await expect(askZangetsu({ question: "hi", ownerId: "12345678901234567", speakerId: "22345678901234567", apiKey: "key" })).rejects.toThrow("empty assistant reply");
	});
});
