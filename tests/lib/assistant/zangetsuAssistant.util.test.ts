import {
  askZangetsu,
  buildZangetsuSystemPrompt,
  cleanAssistantReply,
  trimAssistantHistory,
  ZANGETSU_ASSISTANT_LIMITS,
} from "@lib/assistant/zangetsuAssistant.util";

describe("Zangetsu assistant knowledge", () => {
  it("includes the official app features and platform limitations", () => {
    const prompt = buildZangetsuSystemPrompt();
    expect(prompt).toContain("mpv engine");
    expect(prompt).toContain("Android TV");
    expect(prompt).toContain("TestFlight beta");
    expect(prompt).toContain("Watch Party");
    expect(prompt).toContain("AniList");
    expect(prompt).toContain("Incognito mode");
    expect(prompt).toContain("Cloudflare");
  });

  it("explicitly excludes source-repository names, lists, and links", () => {
    const prompt = buildZangetsuSystemPrompt();
    expect(prompt).toContain("Do not provide, name, list, recommend, rank, or link");
    expect(prompt).toContain("never supply source repository names or URLs");
    expect(prompt).not.toContain("github.com/");
    expect(prompt).not.toContain("MewtwoOP1");
  });

  it("clips conversation history to the most recent ten messages", () => {
    const history = Array.from({ length: 14 }, (_, index) => ({
      role: index % 2 === 0 ? "user" as const : "assistant" as const,
      content: `turn-${index}`,
    }));

    expect(trimAssistantHistory(history)).toEqual(history.slice(-10));
    expect(trimAssistantHistory(history)).toHaveLength(ZANGETSU_ASSISTANT_LIMITS.historyMessages);
  });

  it("limits long history messages and strips source-repository URLs from replies", () => {
    expect(trimAssistantHistory([{ role: "user", content: "x".repeat(2_000) }])[0]?.content).toHaveLength(
      ZANGETSU_ASSISTANT_LIMITS.historyChars,
    );
    expect(cleanAssistantReply("Try this https://github.com/example/source for more")).toContain(
      "[source-repository link omitted]",
    );
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
      question: "what are you doing?",
      history: [{ role: "user", content: "hi" }, { role: "assistant", content: "Hey!" }],
      apiKey: "test-groq-key",
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
    expect(payload.messages[0].role).toBe("system");
    expect(payload.messages.at(-3)).toEqual({ role: "user", content: "hi" });
    expect(payload.messages.at(-1)).toEqual({ role: "user", content: "what are you doing?" });
  });

  it("falls back to the Groq model when the legacy OpenRouter model is configured", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: "Hello." } }] }), {
        status: 200, headers: { "content-type": "application/json" },
      }),
    );

    await askZangetsu({
      question: "hi",
      apiKey: "test-key",
      model: "openrouter/auto",
    });
    const payload = JSON.parse(String(jest.mocked(global.fetch).mock.calls[0]?.[1]?.body));
    expect(payload.model).toBe("openai/gpt-oss-20b");
  });

  it("rejects empty questions, missing keys, and empty model responses", async () => {
    await expect(askZangetsu({ question: "  ", apiKey: "key" })).rejects.toThrow("needs a question");
    await expect(askZangetsu({ question: "hi", apiKey: "" })).rejects.toThrow("Groq is not configured");

    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: " " } }] }), {
        status: 200, headers: { "content-type": "application/json" },
      }),
    );
    await expect(askZangetsu({ question: "hi", apiKey: "key" })).rejects.toThrow("empty assistant reply");
  });
});
