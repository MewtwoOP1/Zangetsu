import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { assetPath } from "@core/paths";
import {
	knowledgeEntries,
	loadKnowledgeEntries,
	parseKnowledgeEntry,
	resetKnowledgeEntries,
	type KnowledgeFileProblem,
} from "@lib/knowledge/knowledgeArticles.util";
import { KNOWLEDGE_CONFIDENCES, KNOWLEDGE_PLATFORMS, KNOWLEDGE_SOURCE_TYPES, KNOWLEDGE_TOPICS } from "@lib/knowledge/knowledge.constants";

const directory = assetPath("zangetsu");

describe("the Zangetsu knowledge corpus", () => {
	beforeEach(() => {
		resetKnowledgeEntries();
	});

	it("reads every file in assets/zangetsu without a single complaint", () => {
		const results = loadKnowledgeEntries();
		const broken = results.filter((result): result is KnowledgeFileProblem => !result.ok);

		expect(broken.map((result) => `${result.file}: ${result.reason}`)).toEqual([]);
		expect(results.length).toBeGreaterThan(40);
	});

	it("keeps every entry's id equal to its file name", () => {
		for (const result of loadKnowledgeEntries()) {
			if (!result.ok) continue;
			expect(result.entry.id).toBe(result.file.replace(/\.md$/, ""));
		}
	});

	it("gives every entry a real source, a check date and a confidence", () => {
		for (const entry of knowledgeEntries()) {
			expect(entry.sourceUrl).toMatch(/^https:\/\//);
			expect(entry.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
			expect(KNOWLEDGE_SOURCE_TYPES).toContain(entry.sourceType);
			expect(KNOWLEDGE_CONFIDENCES).toContain(entry.confidence);
			expect(KNOWLEDGE_TOPICS).toContain(entry.topic);
			expect(KNOWLEDGE_PLATFORMS).toContain(entry.platform);
			expect(entry.body.trim()).not.toBe("");
		}
	});

	/** A community report nobody confirmed is the one thing that must never be presented as settled. */
	it("never lets a community report claim high confidence", () => {
		for (const entry of knowledgeEntries()) {
			if (entry.sourceType !== "community") continue;
			expect(entry.confidence).not.toBe("high");
		}
	});

	it("gives every entry the words a member would use to find it", () => {
		for (const entry of knowledgeEntries()) {
			expect(entry.keywords.length).toBeGreaterThan(0);
			expect(entry.questions.length).toBeGreaterThan(0);
		}
	});

	it("covers every support surface the app has", () => {
		const topics = new Set(knowledgeEntries().map((entry) => entry.topic));

		for (const topic of KNOWLEDGE_TOPICS) {
			expect(topics.has(topic)).toBe(true);
		}
	});

	it("keeps the corpus free of anything that looks like a secret", () => {
		const forbidden = [/discord_token/i, /mongodb:\/\//i, /\bsk-[a-z0-9]{16,}/i, /\bgh[pousr]_\w{20,}/i, /-----BEGIN/];

		for (const file of readdirSync(directory).filter((name) => name.endsWith(".md"))) {
			const source = readFileSync(join(directory, file), "utf8");
			for (const pattern of forbidden) {
				expect(source).not.toMatch(pattern);
			}
		}
	});

	it("refuses a file with no frontmatter, a bad topic or a mismatched id", () => {
		expect(parseKnowledgeEntry("x.md", "no frontmatter here")).toEqual({
			ok: false,
			file: "x.md",
			reason: "has no frontmatter",
		});

		const base = [
			"---",
			"id: something",
			"title: A title",
			"topic: install",
			"platform: any",
			"versions:",
			"keywords: a, b",
			"questions: a question?",
			"sourceUrl: https://example.com/guide",
			"sourceType: official",
			"checkedAt: 2026-01-01",
			"confidence: high",
			"---",
			"The body.",
		].join("\n");

		expect(parseKnowledgeEntry("something.md", base).ok).toBe(true);
		expect(parseKnowledgeEntry("other.md", base)).toEqual({
			ok: false,
			file: "other.md",
			reason: "id does not match the file name",
		});
		expect(parseKnowledgeEntry("something.md", base.replace("topic: install", "topic: nonsense")).ok).toBe(false);
		expect(parseKnowledgeEntry("something.md", base.replace("checkedAt: 2026-01-01", "checkedAt: yesterday")).ok).toBe(false);
		expect(parseKnowledgeEntry("something.md", base.replace("sourceUrl: https://example.com/guide", "sourceUrl: nope")).ok).toBe(
			false,
		);
	});
});
