import { LIMITS } from "@config/constants";

/** Turning a model's answer into something Discord renders the way it was meant. */

/** The HTML tags a model may reach for, which Discord does not render. */
const HTML_TAG_PATTERN =
	/<\/?(?:b|i|u|s|em|strong|small|sub|sup|p|br|hr|div|span|h[1-6]|ul|ol|li|blockquote|table|thead|tbody|tfoot|tr|td|th|caption|pre|code|a|img|figure|figcaption|center|font)(?:\s[^>]*)?>/gi;

/** A Markdown heading, which Discord has no way to render. */
const HEADING_PATTERN = /^(#{1,6})\s+(.*)$/;

/** A row of a Markdown table. */
const TABLE_ROW_PATTERN = /^\s*\|(.+)\|\s*$/;

/** The rule under a Markdown table's header, which is not a row. */
const TABLE_DIVIDER_PATTERN = /^\s*\|(?:\s*:?-{2,}:?\s*\|)+\s*$/;

/**
 * Rewrites the Markdown a model writes into the Markdown Discord renders.
 *
 * Headings become bold lines, tables become lists, and HTML becomes nothing. What is left is what
 * Discord can actually show.
 */
export function normaliseDiscordMarkdown(text: string): string {
	const withoutHtml = text.replace(HTML_TAG_PATTERN, "");

	const lines = withoutHtml.split("\n");
	const output: string[] = [];
	let index = 0;

	while (index < lines.length) {
		const line = lines[index] ?? "";

		if (TABLE_ROW_PATTERN.test(line)) {
			const block: string[] = [];
			while (index < lines.length && TABLE_ROW_PATTERN.test(lines[index] ?? "")) {
				block.push(lines[index] ?? "");
				index += 1;
			}
			output.push(...tableToList(block));
			continue;
		}

		const heading = HEADING_PATTERN.exec(line);
		if (heading !== null) {
			const text_ = (heading[2] ?? "").trim();
			if (text_ !== "") output.push(`**${text_}**`);
			index += 1;
			continue;
		}

		if (/^\s*(?:---+|\*\*\*+|___+)\s*$/.test(line)) {
			output.push("──────────");
			index += 1;
			continue;
		}

		output.push(line.replace(/[ \t]+$/, ""));
		index += 1;
	}

	return output
		.join("\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

/** A Markdown table becomes a list, because a table in Discord is unreadable. */
function tableToList(block: readonly string[]): string[] {
	const rows = block
		.filter((row) => !TABLE_DIVIDER_PATTERN.test(row))
		.map((row) =>
			(row.replace(TABLE_ROW_PATTERN, "$1") ?? "")
				.split("|")
				.map((cell) => cell.trim())
				.filter((cell) => cell !== ""),
		);

	const [header, ...body] = rows;
	if (header === undefined) return [];

	const lines = body.map((cells) => {
		const pairs = header
			.map((name, position) => {
				const value = cells[position];
				return value === undefined || value === "" ? null : `**${name}**: ${value}`;
			})
			.filter((pair): pair is string => pair !== null);

		return pairs.length === 0 ? "" : `- ${pairs.join(" — ")}`;
	});

	return lines.filter((line) => line !== "");
}

/** Whether a line opens or closes a code fence, and which language it opens with. */
function fenceOf(line: string): { closing: boolean; language: string } | null {
	const match = /^\s*(`{3,}|~{3,})\s*([A-Za-z0-9+#._-]*)\s*$/.exec(line);
	if (match === null) return null;

	const marker = match[1] ?? "```";
	return { closing: marker.startsWith("`") ? marker.length >= 3 : marker.length >= 3, language: match[2] ?? "" };
}

/**
 * Breaks an answer into pieces Discord will accept.
 *
 * A code fence is never broken in half: a piece that opens one closes it, and the next piece opens it
 * again. A list is broken between items rather than through one.
 */
export function splitDiscordMessage(text: string, limit = LIMITS.messageContent): string[] {
	const trimmed = text.trim();
	if (trimmed === "") return [];
	if (trimmed.length <= limit) return [trimmed];

	const parts: string[] = [];
	let current = "";
	let inFence = false;
	let fenceLanguage = "";

	const push = (): void => {
		const piece = current.trimEnd();
		if (piece !== "") parts.push(piece);
		current = "";
	};

	for (const line of trimmed.split("\n")) {
		const fence = fenceOf(line);

		if (fence !== null) {
			if (!inFence) {
				inFence = true;
				fenceLanguage = fence.language;
			} else {
				inFence = false;
				fenceLanguage = "";
			}
			current += (current === "" ? "" : "\n") + line;
			continue;
		}

		const addition = (current === "" ? "" : "\n") + line;
		if (current !== "" && current.length + addition.length > limit) {
			if (inFence) {
				// Close the fence here and open it again in the next piece, so neither loses its code.
				push();
				current = "```" + fenceLanguage + "\n" + line;
				continue;
			}

			push();
			current = line;
			continue;
		}

		current += addition;
	}

	push();

	// A piece that is still too long is a single unbroken run, such as one enormous code line.
	const final: string[] = [];
	for (const part of parts) {
		if (part.length <= limit) {
			final.push(part);
			continue;
		}

		for (let start = 0; start < part.length; start += limit) {
			final.push(part.slice(start, start + limit));
		}
	}

	return final.filter((part) => part.trim() !== "");
}

export interface DiscordReply {
	/** The text, which may be empty when the answer is an embed. */
	content: string;
	/** The heading of the embed, when the answer had one. */
	title: string | null;
	/** The body of the embed. */
	description: string | null;
	/** The steps of the answer, one field each. */
	fields: { name: string; value: string }[];
}

/**
 * Turns an answer into the pieces a Discord message is made of.
 *
 * An answer with a heading and numbered steps is an embed, because that is what an embed is for. An
 * ordinary reply is text, because a normal conversation should not look like a form.
 */
export function buildDiscordReply(text: string): DiscordReply {
	const normalised = normaliseDiscordMarkdown(text);
	const lines = normalised.split("\n");

	const headingIndex = lines.findIndex((line) => /^\*\*.+\*\*$/.test(line.trim()) && line.trim().length > 4);
	const steps = lines.filter((line) => /^\s*\d+[.)]\s+\S/.test(line));

	if (headingIndex === -1 || steps.length < 2) {
		return { content: normalised, title: null, description: null, fields: [] };
	}

	const title = (lines[headingIndex] ?? "").trim().replace(/^\*\*|\*\*$/g, "");
	const stepLines = steps.map((line) => line.trim());

	const before = lines.slice(0, headingIndex).join("\n").trim();
	const after = lines.slice(lines.indexOf(steps[0] ?? "")).join("\n").trim();

	return {
		content: before === "" ? "" : before,
		title,
		description: after === "" ? null : after,
		fields: stepLines.map((step, index) => ({
			name: `Step ${String(index + 1)}`,
			value: step.replace(/^\d+[.)]\s+/, ""),
		})),
	};
}

/** Whether the answer is worth putting in an embed rather than in the channel. */
export function wantsEmbed(reply: DiscordReply): boolean {
	return reply.title !== null && reply.fields.length > 0;
}
