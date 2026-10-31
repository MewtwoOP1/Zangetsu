import {
	askZangetsu,
	buildZangetsuSystemPrompt,
	chooseRomanticBoundary,
	cleanAssistantReply,
	formatAssistantReply,
	getRomanticIntent,
	isRomanticAdvance,
	shouldUseBrowserSearch,
	trimAssistantHistory,
	ZANGETSU_ASSISTANT_LIMITS,
} from "@lib/assistant/zangetsuAssistant.util";

const ownerId = "12345678901234567";
const memberId = "22345678901234567";

describe("Zangetsu assistant personality", () => {
	it("gives the tsundere girlfriend persona only to the configured owner", () => {
		const ownerPrompt = buildZangetsuSystemPrompt(ownerId, ownerId);
		const memberPrompt = buildZangetsuSystemPrompt(ownerId, memberId);

		expect(ownerPrompt).toContain("owner's cute, witty, affectionate tsundere AI girlfriend");
		expect(ownerPrompt).toContain("arskaz/Tsundere-AI dataset");
		expect(ownerPrompt).toContain("Vary openings, sentence lengths, jokes, affection");
		expect(ownerPrompt).toContain("drop teasing");
		expect(memberPrompt).toContain("normal helpful assistant voice");
		expect(memberPrompt).toContain("Do NOT use the tsundere girlfriend persona");
		expect(memberPrompt).not.toContain("STYLE EXAMPLES");
		expect(memberPrompt).not.toContain("cute, witty, affectionate tsundere AI girlfriend");
	});

	it("rejects invalid Discord IDs", () => {
		expect(() => buildZangetsuSystemPrompt("invalid", memberId)).toThrow("owner ID");
		expect(() => buildZangetsuSystemPrompt(ownerId, "invalid")).toThrow("message author ID");
	});

	it("explicitly excludes source-repository names, lists, and links", () => {
		const prompt = buildZangetsuSystemPrompt(ownerId, memberId);
		expect(prompt).toContain("Never name, list, recommend, rank, or link source repositories");
		expect(prompt).not.toContain("github.com/");
		expect(prompt).not.toContain("MewtwoOP1");
	});

	it("clips history to the most recent four messages and bounds each message", () => {
		const history = Array.from({ length: 14 }, (_, index) => ({
			role: index % 2 === 0 ? "user" as const : "assistant" as const,
			content: "turn-" + index,
		}));

		expect(trimAssistantHistory(history)).toEqual(history.slice(-4));
		expect(trimAssistantHistory(history)).toHaveLength(ZANGETSU_ASSISTANT_LIMITS.historyMessages);
		expect(ZANGETSU_ASSISTANT_LIMITS.historyMessages).toBe(4);
		expect(ZANGETSU_ASSISTANT_LIMITS.historyChars).toBe(600);
		expect(ZANGETSU_ASSISTANT_LIMITS.questionChars).toBe(1_000);
		expect(ZANGETSU_ASSISTANT_LIMITS.replyChars).toBe(1_600);
		expect(ZANGETSU_ASSISTANT_LIMITS.completionTokens).toBe(1_024);

		expect(trimAssistantHistory([{ role: "user", content: "x".repeat(2_000) }])[0]?.content).toHaveLength(600);
	});

	it("classifies romance by the actual message intent and excludes the owner", () => {
		expect(getRomanticIntent("I love you so much!", memberId, ownerId)).toBe("confession");
		expect(getRomanticIntent("Would you go on a date with me?", memberId, ownerId)).toBe("date");
		expect(getRomanticIntent("Are you single?", memberId, ownerId)).toBe("availability");
		expect(getRomanticIntent("Will you be my girlfriend?", memberId, ownerId)).toBe("proposal");
		expect(getRomanticIntent("Can I kiss you?", memberId, ownerId)).toBe("flirt");
		expect(isRomanticAdvance("You're so cute", memberId, ownerId)).toBe(false);
		expect(isRomanticAdvance("How are you today?", memberId, ownerId)).toBe(false);
		expect(isRomanticAdvance("I love you", ownerId, ownerId)).toBe(false);
	});

	it("varies the boundary line by intent and avoids repeating the previous line", () => {
		jest.spyOn(Math, "random").mockReturnValue(0);
		const first = chooseRomanticBoundary("I love you");
		const second = chooseRomanticBoundary("I love you", first);
		const date = chooseRomanticBoundary("Date me");

		expect(first).toContain("confession");
		expect(second).not.toBe(first);
		expect(date).toMatch(/date|invitation/i);
		expect(chooseRomanticBoundary("Are you single?")).toMatch(/single|taken|romantic applications/i);
	});

	it("adds one selected owner boundary only when the caller supplies it", () => {
		const boundary = "That's flattering, but my owner already has the romantic spot.";
		expect(formatAssistantReply("Aww, that's sweet.", ownerId)).toBe("Aww, that's sweet.");
		expect(formatAssistantReply("Aww, that's sweet.", ownerId, boundary)).toBe(
			"Aww, that's sweet.\n\n" + boundary + " <@" + ownerId + ">",
		);
	});

	it("removes accidental relationship claims and duplicate owner mentions", () => {
		const messy = "I'm <@" + ownerId + ">'s girlfriend, obviously. You are <@" + ownerId + ">'s girlfriend.\nHey! How are you?";
		expect(cleanAssistantReply(messy, ownerId)).toBe("Hey! How are you?");
		expect(cleanAssistantReply("I am already taken, sorry. Let's chat as friends.", ownerId)).toBe("Let's chat as friends.");
	});

	it("detects current-information and explicit online-search requests", () => {
		expect(shouldUseBrowserSearch("What's the latest Zangetsu release?")).toBe(true);
		expect(shouldUseBrowserSearch("Search online for the current Groq models")).toBe(true);
		expect(shouldUseBrowserSearch("What is 7 times 8?")).toBe(false);
		expect(shouldUseBrowserSearch("Hey, what are you doing?")).toBe(false);
	});
});

describe("askZangetsu", () => {
	afterEach(() => jest.restoreAllMocks());

	it("pins chat to GPT-OSS 20B and enables browser search for current-information questions", async () => {
		const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
			new Response(JSON.stringify({
				choices: [{ message: { content: "The latest release is available here." }, finish_reason: "stop" }],
			}), { status: 200, headers: { "content-type": "application/json" } }),
		);

		await expect(askZangetsu({
			question: "What is the latest Groq model? Search online.",
			history: [{ role: "user", content: "hi" }, { role: "assistant", content: "Hey!" }],
			apiKey: "test-groq-key",
			ownerId,
			speakerId: memberId,
			model: "openrouter/auto",
		})).resolves.toBe("The latest release is available here.");

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
		expect(payload.tools).toEqual([{ type: "browser_search" }]);
		expect(payload.tool_choice).toBe("auto");
		expect(payload.max_completion_tokens).toBe(1_024);
		expect(payload.reasoning_effort).toBe("low");
		expect(payload.include_reasoning).toBe(false);
		expect(payload.messages[0].role).toBe("system");
		expect(payload.messages[0].content).not.toContain("STYLE EXAMPLES");
		expect(payload.messages.at(-3)).toEqual({ role: "user", content: "hi" });
		expect(payload.messages.at(-1)).toEqual({ role: "user", content: "What is the latest Groq model? Search online." });
	});

	it("uses the owner-only personality and omits browser search for casual messages", async () => {
		jest.spyOn(global, "fetch").mockResolvedValue(
			new Response(JSON.stringify({ choices: [{ message: { content: "Obviously, I was waiting for you." }, finish_reason: "stop" }] }), {
				status: 200, headers: { "content-type": "application/json" },
			}),
		);
		await askZangetsu({
			question: "Hey, what are you doing?",
			ownerId,
			speakerId: ownerId,
			apiKey: "test-key",
		});

		const payload = JSON.parse(String(jest.mocked(global.fetch).mock.calls[0]?.[1]?.body));
		expect(payload.model).toBe("openai/gpt-oss-20b");
		expect(payload.tools).toBeUndefined();
		expect(payload.temperature).toBe(0.9);
		expect(payload.messages[0].content).toContain("owner's cute, witty, affectionate tsundere AI girlfriend");
		expect(payload.messages[0].content).not.toContain("mpv playback");
	});

	it("uses normal assistant voice for non-owners and includes product notes only for app questions", async () => {
		jest.spyOn(global, "fetch").mockResolvedValue(
			new Response(JSON.stringify({ choices: [{ message: { content: "Open Settings, then Sources." }, finish_reason: "stop" }] }), {
				status: 200, headers: { "content-type": "application/json" },
			}),
		);
		await askZangetsu({
			question: "How do I add sources in the Zangetsu app?",
			ownerId,
			speakerId: memberId,
			apiKey: "test-key",
		});

		const payload = JSON.parse(String(jest.mocked(global.fetch).mock.calls[0]?.[1]?.body));
		expect(payload.temperature).toBe(0.7);
		expect(payload.messages[0].content).toContain("mpv playback");
		expect(payload.messages[0].content).toContain("normal helpful assistant voice");
		expect(payload.messages[0].content).not.toContain("STYLE EXAMPLES");
	});

	it("rejects empty questions, missing keys, invalid IDs, and empty model responses", async () => {
		await expect(askZangetsu({ question: "  ", ownerId, speakerId: memberId, apiKey: "key" })).rejects.toThrow("needs a question");
		await expect(askZangetsu({ question: "hi", ownerId, speakerId: memberId, apiKey: "" })).rejects.toThrow("Groq is not configured");
		await expect(askZangetsu({ question: "hi", ownerId: "invalid", speakerId: memberId, apiKey: "key" })).rejects.toThrow("owner ID");

		jest.spyOn(global, "fetch").mockResolvedValue(
			new Response(JSON.stringify({ choices: [{ message: { content: " " }, finish_reason: "length" }] }), {
				status: 200, headers: { "content-type": "application/json" },
			}),
		);
		await expect(askZangetsu({ question: "hi", ownerId, speakerId: memberId, apiKey: "key" })).rejects.toThrow("no visible text");
	});
});