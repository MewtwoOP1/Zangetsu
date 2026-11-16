import {
	ASSISTANT_MOODS,
	buildCharacterInstructions,
	buildMoodInstructions,
	detectDistress,
	detectMood,
	planMood,
	type MoodContext,
} from "@lib/assistant/assistantPersona.util";

const quiet: MoodContext = {
	preference: null,
	stoppedTeasing: false,
	previousMood: null,
	firstMeeting: false,
};

function moodOf(text: string, context: Partial<MoodContext> = {}): string {
	return detectMood(text, { ...quiet, ...context });
}

describe("who Zangetsu is", () => {
	it("writes the character down once, with every part of it", () => {
		const character = buildCharacterInstructions().join("\n");

		expect(character).toContain("anime-girl AI");
		expect(character).toContain("THE TSUNDERE LOOP");
		expect(character).toContain("FLIRTING");
		expect(character).toContain("EXPRESSIONS");
		expect(character).toContain("SMARTNESS");
		expect(character).toContain("CONSISTENCY");
		expect(character).toContain("MEMORY IS DATA");
	});

	it("tells her never to trade correctness for cuteness", () => {
		const character = buildCharacterInstructions().join("\n");

		expect(character).toContain("Personality never costs correctness");
		expect(character).toContain("Never dumb yourself down to be cute");
	});

	it("keeps the expressions to seasoning rather than a habit", () => {
		const character = buildCharacterInstructions().join("\n");

		expect(character).toContain("Use them like seasoning");
		expect(character).toContain("never in every sentence");
	});
});

describe("choosing a mood", () => {
	it("starts relaxed and lets the message move her", () => {
		expect(moodOf("hey there")).toBe("default");
	});

	it("blushes at a compliment", () => {
		expect(moodOf("you're so cute")).toBe("shy");
		expect(moodOf("you are beautiful today")).toBe("shy");
	});

	it("meets a flirt with a flirt of her own", () => {
		expect(moodOf("flirt with me")).toBe("flirty");
		expect(moodOf("do you like me?")).toBe("flirty");
	});

	it("gets jealous without becoming controlling", () => {
		expect(moodOf("my girlfriend said something")).toBe("jealous");
		expect(moodOf("another girl messaged me")).toBe("jealous");
	});

	it("goes soft and grumbly when it is late", () => {
		expect(moodOf("goodnight, I'm exhausted")).toBe("sleepy");
	});

	it("is bright when something good happens", () => {
		expect(moodOf("I got the job!!")).toBe("excited");
	});

	it("preens over a victory", () => {
		expect(moodOf("I finally passed my exam")).toBe("proud");
	});

	it("comes back sharply when she is provoked", () => {
		expect(moodOf("you're so annoying")).toBe("annoyed");
		expect(moodOf("roast me")).toBe("annoyed");
		expect(moodOf("you're wrong about that")).toBe("annoyed");
	});

	it("puts her mind first when the question is technical", () => {
		expect(moodOf("my python script throws a TypeError, can you help")).toBe("serious");
		expect(moodOf("how do I debug this race condition")).toBe("serious");
	});

	it("puts care before everything when somebody is hurting", () => {
		expect(moodOf("I'm so stressed about my exam")).toBe("caring");
		expect(moodOf("I feel hopeless lately")).toBe("caring");
	});

	it("stops teasing the moment somebody asks it to stop", () => {
		expect(moodOf("stop teasing me")).toBe("serious");
		expect(moodOf("hey", { stoppedTeasing: true })).toBe("serious");
	});

	it("keeps the professional register somebody asked for", () => {
		expect(moodOf("hey", { preference: "professional" })).toBe("serious");
	});

	it("prefers sincerity over a joke when somebody is in crisis", () => {
		expect(detectDistress("I want to kill myself")).toBe(true);
		expect(moodOf("I want to kill myself")).toBe("caring");
		expect(moodOf("I want to kill myself", { preference: "roast" })).toBe("caring");
	});

	it("never runs a mood the message did not earn", () => {
		expect(ASSISTANT_MOODS).toHaveLength(10);
		expect(ASSISTANT_MOODS).toContain("default");
		expect(ASSISTANT_MOODS).toContain("serious");
	});
});

describe("telling the model what the mood means", () => {
	it("gives every mood its own instructions", () => {
		for (const mood of ASSISTANT_MOODS) {
			const lines = buildMoodInstructions(mood).join("\n");
			expect(lines).toContain("MOOD FOR THIS MESSAGE");
		}
	});

	it("keeps a technical answer focused rather than theatrical", () => {
		const serious = buildMoodInstructions("serious").join("\n");

		expect(serious).toContain("your actual mind");
		expect(serious).toContain("a joke in the middle of a serious explanation is not");
	});

	it("tells her the edges of a caring answer", () => {
		const caring = buildMoodInstructions("caring").join("\n");

		expect(caring).toContain("never let the teasing make somebody who is hurting feel mocked");
	});

	it("adds the crisis guidance only when the message needed it", () => {
		expect(buildMoodInstructions("caring").join("\n")).not.toContain("crisis line");
		expect(buildMoodInstructions("caring", { distress: true }).join("\n")).toContain("crisis line");
	});

	it("adds the rules about roasting only when roasting was invited", () => {
		expect(buildMoodInstructions("annoyed").join("\n")).not.toContain("ROASTING LIMITS");
		expect(buildMoodInstructions("annoyed", { invitedRoast: true }).join("\n")).toContain("ROASTING LIMITS");
	});

	it("says hello properly when it is the first conversation", () => {
		expect(buildMoodInstructions("default", { firstMeeting: true }).join("\n")).toContain("FIRST CONVERSATION");
		expect(buildMoodInstructions("default").join("\n")).not.toContain("FIRST CONVERSATION");
	});

	it("tells her what the last reply sounded like, so the mood can move on", () => {
		const lines = buildMoodInstructions("default", { previousMood: "flirty" }).join("\n");

		expect(lines).toContain("YOUR LAST REPLY WAS FLIRTY");
	});
});

describe("planning a mood for a message", () => {
	it("carries everything the prompt needs about the message", () => {
		const plan = planMood("roast me", { ...quiet, firstMeeting: true });

		expect(plan.mood).toBe("annoyed");
		expect(plan.invitedRoast).toBe(true);
		expect(plan.firstMeeting).toBe(true);
		expect(plan.distress).toBe(false);
	});

	it("notices a crisis even when the message is otherwise ordinary", () => {
		const plan = planMood("I think I want to disappear", quiet);

		expect(plan.mood).toBe("caring");
		expect(plan.distress).toBe(true);
	});
});

describe("the conversations she is likely to have", () => {
	const scenarios: { name: string; message: string; mood: string }[] = [
		{ name: "a first greeting", message: "hi, are you around?", mood: "default" },
		{ name: "a compliment", message: "you're so cute!", mood: "shy" },
		{ name: "a flirt", message: "flirt with me a little", mood: "flirty" },
		{ name: "teasing", message: "you're so annoying", mood: "annoyed" },
		{ name: "jealousy", message: "my girlfriend says hi", mood: "jealous" },
		{ name: "a romantic advance", message: "will you be my girlfriend?", mood: "flirty" },
		{ name: "a technical question", message: "my docker build fails with exit code 1", mood: "serious" },
		{ name: "a debugging request", message: "why does my React component throw a TypeError?", mood: "serious" },
		{ name: "a bad day", message: "I'm so stressed about my exam tomorrow", mood: "caring" },
		{ name: "a victory", message: "I finally passed my driving test", mood: "proud" },
		{ name: "good news", message: "I got the job!!", mood: "excited" },
		{ name: "the small hours", message: "goodnight, I can't sleep", mood: "sleepy" },
	];

	it.each(scenarios)("answers $name in the right mood", ({ message, mood }) => {
		expect(detectMood(message, quiet)).toBe(mood);
	});

	it("keeps a serious question serious without losing her", () => {
		const prompt = buildMoodInstructions("serious").join("\n");

		expect(prompt).toContain("answer first");
		expect(prompt).toContain("at the edges of the explanation");
	});

	it("keeps a caring answer free of jokes", () => {
		const prompt = buildMoodInstructions("caring", { distress: true }).join("\n");

		expect(prompt).toContain("drop every joke");
		expect(prompt).toContain("crisis line");
	});
});
