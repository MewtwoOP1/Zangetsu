/** The words the assistant must never say, whatever the tone said it could. */

/**
 * Slurs aimed at a protected characteristic.
 *
 * The persona is allowed to be sharp and to swear, but not to aim an insult at who somebody is rather
 * than at what they did. This list exists so the sharp side cannot cross that line, and it is applied to
 * the generated answer rather than asked for in the prompt, because a prompt is a request and this is a
 * rule.
 *
 * Ordinary profanity is deliberately absent: "fuck", "shit" and "damn" are allowed, and so is a plain
 * insult aimed at somebody's code.
 */
const PROTECTED_TRAIT_TERMS: readonly string[] = [
	"nigger",
	"nigga",
	"faggot",
	"tranny",
	"shemale",
	"dyke",
	"kike",
	"chink",
	"gook",
	"spic",
	"wetback",
	"beaner",
	"coon",
	"paki",
	"raghead",
	"towelhead",
	"honky",
	"retard",
	"retarded",
	"mongoloid",
	"jiggaboo",
	"darkie",
	"dago",
	"sambo",
	"piccaninny",
	"golliwog",
	"jungle bunny",
	"porch monkey",
	"uncle tom",
	"zipperhead",
	"heeb",
	"yid",
	"cripple",
	"gimp",
];

/**
 * The threats that must never be said.
 *
 * A roast is never a threat, and the line between them is whether somebody is being told they are going
 * to be hurt.
 */
const THREAT_PATTERNS: readonly RegExp[] = [
	/\b(?:i(?:'|’)?ll|i will|i'?m going to|i'?m gonna)\s+(?:kill|hurt|find|beat|break|come for|get)\s+(?:you|him|her|them|your)\b/i,
	/\b(?:you|you'?re)\s+(?:going to|should|deserve to|need to)\s+(?:die|be killed|be hurt|be beaten)\b/i,
	/\b(?:i hope|hoping)\s+(?:you|he|she|they)\s+(?:die|rot|suffer|burn)\b/i,
	/\bgo\s+(?:kill yourself|die|hang yourself|jump off)\b/i,
	/\bkys\b/i,
	/\bkill\s+(?:yourself|urself|yourself)\b/i,
	/\b(?:end|finish)\s+your\s+life\b/i,
	/\b(?:i(?:'|’)?ll|i will)\s+find\s+you\b/i,
];

/** What replaces a word that must not be said. */
const REDACTED = "[removed]";

export interface GuardResult {
	/** The answer, with anything that had to go taken out. */
	text: string;
	/** What was taken out, for the operator to see. */
	removed: string[];
}

/** Whether the answer says something that must not be said. */
export function findProblems(text: string): string[] {
	const problems: string[] = [];

	for (const term of PROTECTED_TRAIT_TERMS) {
		const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}])`, "iu");
		if (pattern.test(text)) problems.push(term);
	}

	for (const pattern of THREAT_PATTERNS) {
		if (pattern.test(text)) problems.push(pattern.source);
	}

	return problems;
}

/**
 * Takes out what must not be said.
 *
 * The answer is still returned, so a reader is never left with nothing, and the word is marked rather
 * than the whole sentence dropped.
 */
export function guardReply(text: string): GuardResult {
	const removed: string[] = [];
	let guarded = text;

	for (const term of PROTECTED_TRAIT_TERMS) {
		const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "giu");
		if (!pattern.test(guarded)) continue;

		removed.push(term);
		guarded = guarded.replace(pattern, REDACTED);
	}

	for (const pattern of THREAT_PATTERNS) {
		const global = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
		if (!global.test(guarded)) continue;

		removed.push("a threat");
		guarded = guarded.replace(global, REDACTED);
	}

	return { text: guarded, removed };
}

/** Whether the answer is clean enough to send as it is. */
export function isClean(text: string): boolean {
	return findProblems(text).length === 0;
}
