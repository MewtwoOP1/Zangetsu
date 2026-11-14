import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { assetPath } from "@core/paths";
import {
	KNOWLEDGE_CONFIDENCES,
	KNOWLEDGE_LIMITS,
	KNOWLEDGE_PLATFORMS,
	KNOWLEDGE_SOURCE_TYPES,
	KNOWLEDGE_TOPICS,
} from "@lib/knowledge/knowledge.constants";
import { type KnowledgeEntry } from "@lib/knowledge/knowledge.types";

/** The written Zangetsu app knowledge in `assets/zangetsu`, one Markdown file per answer. */

const FRONTMATTER = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;

const listOf =
	(separator: string) =>
	(value: string): string[] =>
		value
			.split(separator)
			.map((part) => part.trim())
			.filter((part) => part !== "");

const frontmatter = z
	.object({
		id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "must be lowercase words separated by hyphens"),
		title: z.string().min(3).max(160),
		topic: z.enum(KNOWLEDGE_TOPICS),
		platform: z.enum(KNOWLEDGE_PLATFORMS).default("any"),
		versions: z.string().max(80).default(""),
		keywords: z.string().default(""),
		questions: z.string().default(""),
		errorStrings: z.string().default(""),
		sourceUrl: z.string().url(),
		sourceType: z.enum(KNOWLEDGE_SOURCE_TYPES),
		checkedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be an ISO date"),
		confidence: z.enum(KNOWLEDGE_CONFIDENCES),
		outdated: z.enum(["true", "false"]).default("false"),
	})
	.strict();

export interface KnowledgeFileProblem {
	ok: false;
	file: string;
	reason: string;
}

export type KnowledgeFileResult = { ok: true; file: string; entry: KnowledgeEntry } | KnowledgeFileProblem;

export function parseKnowledgeEntry(file: string, source: string): KnowledgeFileResult {
	const match = FRONTMATTER.exec(source.replace(/\r\n/g, "\n"));
	if (match === null) return { ok: false, file, reason: "has no frontmatter" };

	const [, head = "", body = ""] = match;
	const fields = Object.fromEntries(
		head.split("\n").flatMap((line) => {
			const at = line.indexOf(":");
			return at === -1 ? [] : [[line.slice(0, at).trim(), line.slice(at + 1).trim()]];
		}),
	);

	const parsed = frontmatter.safeParse(fields);
	if (!parsed.success) {
		return { ok: false, file, reason: parsed.error.issues.map((issue) => `${issue.path.join(".")} ${issue.message}`).join("; ") };
	}
	if (`${parsed.data.id}.md` !== file) return { ok: false, file, reason: "id does not match the file name" };

	const text = body.trim();
	if (text === "") return { ok: false, file, reason: "body is empty" };
	if (text.length > KNOWLEDGE_LIMITS.totalChars) return { ok: false, file, reason: "body is too long" };

	const { id, title, topic, platform, versions, sourceUrl, sourceType, checkedAt, confidence, outdated } = parsed.data;
	return {
		ok: true,
		file,
		entry: {
			id,
			title,
			topic,
			platform,
			versions,
			keywords: listOf(",")(parsed.data.keywords),
			questions: listOf("|")(parsed.data.questions),
			errorStrings: listOf("|")(parsed.data.errorStrings),
			sourceUrl,
			sourceType,
			checkedAt,
			confidence,
			outdated: outdated === "true",
			body: text,
		},
	};
}

export function loadKnowledgeEntries(directory = assetPath("zangetsu")): KnowledgeFileResult[] {
	return readdirSync(directory)
		.filter((file) => file.endsWith(".md"))
		.sort()
		.map((file) => parseKnowledgeEntry(file, readFileSync(join(directory, file), "utf8")));
}

let cached: KnowledgeEntry[] | null = null;

/** The corpus, read once and kept, since the files never change while the bot runs. */
export function knowledgeEntries(): KnowledgeEntry[] {
	if (cached !== null) return cached;

	const entries: KnowledgeEntry[] = [];
	for (const result of loadKnowledgeEntries()) {
		if (result.ok) entries.push(result.entry);
	}
	cached = entries;
	return cached;
}

/** Used by the tests so each one can read a corpus of its own. */
export function resetKnowledgeEntries(): void {
	cached = null;
}
