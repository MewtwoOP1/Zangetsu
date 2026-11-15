import { splitDiscordMessage } from "@lib/assistant/assistantFormat.util";

/** Counts surrogate halves that were left without their partner. */
function loneSurrogates(text: string): number {
	let count = 0;
	for (let index = 0; index < text.length; index += 1) {
		const code = text.charCodeAt(index);
		if (code >= 0xd800 && code <= 0xdbff) {
			const next = text.charCodeAt(index + 1);
			if (next >= 0xdc00 && next <= 0xdfff) index += 1;
			else count += 1;
		} else if (code >= 0xdc00 && code <= 0xdfff) {
			count += 1;
		}
	}
	return count;
}

function squash(text: string): string {
	return text.replace(/\s+/g, " ").trim();
}

describe("splitting an answer for Discord", () => {
	it("leaves a message that fits alone", () => {
		expect(splitDiscordMessage("Open Settings, then Sources.")).toEqual(["Open Settings, then Sources."]);
	});

	it("returns nothing for nothing", () => {
		expect(splitDiscordMessage("   ")).toEqual([]);
		expect(splitDiscordMessage("")).toEqual([]);
	});

	it("accepts a message of exactly Discord's limit", () => {
		const text = "a".repeat(2_000);
		expect(splitDiscordMessage(text)).toEqual([text]);
	});

	it("breaks a message one character over the limit", () => {
		const text = "a".repeat(2_001);
		const parts = splitDiscordMessage(text);

		expect(parts).toHaveLength(2);
		expect(parts.join("")).toBe(text);
	});

	it("keeps every piece inside the limit and loses nothing", () => {
		const text = "First paragraph.\n\nSecond paragraph that is quite a lot longer. ".repeat(80);
		const parts = splitDiscordMessage(text);

		expect(parts.length).toBeGreaterThan(1);
		for (const part of parts) expect(part.length).toBeLessThanOrEqual(2_000);
		expect(squash(parts.join("\n"))).toBe(squash(text));
	});

	it("never cuts an emoji in half", () => {
		const text = "😀".repeat(2_000);
		const parts = splitDiscordMessage(text, 1_901);

		for (const part of parts) {
			expect(part.length).toBeLessThanOrEqual(1_901);
			expect(loneSurrogates(part)).toBe(0);
		}
		expect(parts.join("")).toBe(text);
	});

	it("closes and reopens a code fence so every piece renders", () => {
		const body = Array.from({ length: 200 }, (_, index) => `const value${index} = ${index};`).join("\n");
		const parts = splitDiscordMessage("```ts\n" + body + "\n```");

		expect(parts.length).toBeGreaterThan(1);
		for (const part of parts) {
			expect(part.match(/```/g) ?? []).toHaveLength(2);
		}
		expect(parts[0]).toContain("```ts");
	});

	it("keeps a Markdown link whole rather than cutting through it", () => {
		const link = "https://zangetsu.online/guide/how-to-add-a-repository";
		const text = ("word ".repeat(375) + "See " + link + " " + "word ".repeat(375)).trim();
		const parts = splitDiscordMessage(text);

		expect(parts.filter((part) => part.includes(link))).toHaveLength(1);
		for (const part of parts) expect(part.includes("https://zangetsu.online/guide/how-to")).toBe(part.includes(link));
	});

	it("breaks a long unbroken run instead of sending a message Discord refuses", () => {
		const text = "x".repeat(5_000);
		const parts = splitDiscordMessage(text);

		for (const part of parts) expect(part.length).toBeLessThanOrEqual(2_000);
		expect(parts.join("")).toBe(text);
	});

	it("honours a smaller limit", () => {
		const parts = splitDiscordMessage("word ".repeat(60), 100);

		expect(parts.length).toBeGreaterThan(1);
		for (const part of parts) expect(part.length).toBeLessThanOrEqual(100);
	});
});
