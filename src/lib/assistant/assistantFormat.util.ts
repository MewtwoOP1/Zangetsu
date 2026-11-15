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
			row
				.replace(TABLE_ROW_PATTERN, "$1")
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

/** A line that opens or closes a code fence, with the marker as it was written. */
interface FenceLine {
	marker: string;
	language: string;
}

/** Whether a line opens or closes a code fence, and what it was written with. */
function fenceOf(line: string): FenceLine | null {
	const match = /^\s*(`{3,}|~{3,})\s*([A-Za-z0-9+#._-]*)\s*$/.exec(line);
	if (match === null) return null;

	return { marker: match[1] ?? "```", language: match[2] ?? "" };
}

function isHighSurrogate(code: number): boolean {
	return code >= 0xd800 && code <= 0xdbff;
}

function isLowSurrogate(code: number): boolean {
	return code >= 0xdc00 && code <= 0xdfff;
}

/** Moves a cut before a surrogate pair rather than through it, so no piece ends on half an emoji. */
function wholeCharacter(text: string, index: number): number {
	const at = Math.max(0, Math.min(index, text.length));
	if (at <= 0 || at >= text.length) return at;
	return isHighSurrogate(text.charCodeAt(at - 1)) && isLowSurrogate(text.charCodeAt(at)) ? at - 1 : at;
}

/** Breaks one line that is longer than a piece at its last sentence or word boundary. */
function splitLongLine(line: string, budget: number): string[] {
	const pieces: string[] = [];
	let rest = line;

	while (rest.length > budget) {
		const window = rest.slice(0, budget);
		const sentence = Math.max(window.lastIndexOf(". "), window.lastIndexOf("! "), window.lastIndexOf("? "));
		const space = window.lastIndexOf(" ");
		let cut = sentence > budget * 0.6 ? sentence + 1 : space > budget * 0.6 ? space : budget;
		cut = wholeCharacter(rest, cut);
		if (cut <= 0) cut = wholeCharacter(rest, budget);

		pieces.push(rest.slice(0, cut).trimEnd());
		rest = rest.slice(cut);
	}

	if (rest !== "") pieces.push(rest);
	return pieces;
}

/**
 * Breaks an answer into the messages Discord will accept.
 *
 * A code fence is never broken in half: a piece that opens one closes it, and the next piece opens it
 * again. Pieces break at a line, a sentence or a word before they break inside one, and a cut never
 * falls between the halves of an emoji. The returned pieces always join back into the whole answer.
 */
export function splitDiscordMessage(text: string, limit: number = LIMITS.messageContent): string[] {
	const ceiling = Math.max(1, Math.min(limit, LIMITS.messageContent));
	const trimmed = text.trim();
	if (trimmed === "") return [];
	if (trimmed.length <= ceiling) return [trimmed];

	// Lines longer than a piece are broken here, while the fence they sit in is still known, so the
	// assembly below only ever deals with lines that fit.
	const lines: string[] = [];
	let openMarker = "";
	for (const raw of trimmed.split("\n")) {
		const fence = fenceOf(raw);
		if (fence !== null) {
			openMarker = openMarker === "" ? fence.marker : "";
			lines.push(raw);
			continue;
		}

		const reserve = openMarker === "" ? 0 : openMarker.length + 1;
		lines.push(...(raw.length + reserve <= ceiling ? [raw] : splitLongLine(raw, Math.max(1, ceiling - reserve - 24))));
	}

	const parts: string[] = [];
	let current = "";
	let fenceMarker = "";
	let fenceLanguage = "";

	const push = (): void => {
		const piece = current.trimEnd();
		if (piece.trim() !== "") parts.push(piece);
		current = "";
	};

	const append = (line: string, reopen: boolean): void => {
		const addition = (current === "" ? "" : "\n") + line;
		// Room to close the open fence at the end of this piece, so it is never left hanging.
		const reserve = fenceMarker === "" ? 0 : fenceMarker.length + 1;
		if (current !== "" && current.length + addition.length + reserve > ceiling) {
			if (fenceMarker !== "") current += "\n" + fenceMarker;
			push();
			current = reopen && fenceMarker !== "" ? fenceMarker + fenceLanguage + "\n" : "";
		}

		if (current === "") current = line;
		else if (current.endsWith("\n")) current += line;
		else current += "\n" + line;
	};

	for (const line of lines) {
		const fence = fenceOf(line);

		if (fence === null) {
			append(line, true);
			continue;
		}

		if (fenceMarker === "") {
			append(line, false);
			fenceMarker = fence.marker;
			fenceLanguage = fence.language;
			continue;
		}

		// A closing fence line: when it does not fit, the piece is closed here anyway.
		const addition = (current === "" ? "" : "\n") + line;
		if (current !== "" && current.length + addition.length > ceiling) {
			current += "\n" + fenceMarker;
			push();
		} else {
			append(line, false);
		}
		fenceMarker = "";
		fenceLanguage = "";
	}

	push();

	// Nothing may leave here above the ceiling, whatever the input did.
	const final: string[] = [];
	for (const part of parts) {
		if (part.length <= ceiling) {
			final.push(part);
			continue;
		}
		final.push(...splitLongLine(part, ceiling));
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
	const after = lines
		.slice(lines.indexOf(steps[0] ?? ""))
		.join("\n")
		.trim();

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
