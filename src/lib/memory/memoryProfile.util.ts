import { type MemoryRecord, type TonePreference } from "@lib/memory/memory.types";

/** Turning what was remembered into how the bot behaves. */

const PROFESSIONAL_PATTERN =
	/\b(?:prefers? (?:a )?(?:professional|formal|polished|serious|corporate) (?:replies?|answers?|tone)|professional tone|formal (?:replies?|answers?)|no jokes|stop joking|serious replies?)\b/i;

const ROAST_PATTERN =
	/\b(?:(?:enjoys?|likes?|wants?|likes to be|invites?)\s+(?:roasting|being roasted|the roasting|banter|jokes|roasts?)|roast me|be mean to me|unfiltered|uncensored|sharp(?:er)? comebacks?|friendly roasting)\b/i;

const PLAYFUL_PATTERN = /\b(?:(?:enjoys?|likes?|prefers?)\s+(?:playful|funny|humorous|cheeky|witty))\b/i;

const NEUTRAL_PATTERN = /\b(?:(?:prefers?|wants?)\s+(?:neutral|plain|standard|normal) (?:replies?|answers?|tone))\b/i;

const SHORT_PATTERN = /\b(?:(?:prefers?|wants?|likes?|likes to get)\s+(?:short|brief|concise|terse)(?:\s+(?:replies?|answers?|responses?))?)\b/i;

const DETAILED_PATTERN =
	/\b(?:(?:prefers?|wants?|likes?)\s+(?:detailed|thorough|in-depth|lengthy|full)(?:\s+(?:technical\s+)?(?:explanations?|answers?|responses?))?)\b/i;

const NO_EMOJI_PATTERN = /\b(?:(?:dislikes?|hates?|no)\s+(?:excessive\s+)?emojis?|no emoji)\b/i;

const STOP_TEASING_PATTERN = /\b(?:stop teasing|stop roasting|do not tease|don't tease|no teasing)\b/i;

/**
 * The tone this person has asked for.
 *
 * The most recently stated preference wins, because a person who says "be serious now" means it now.
 */
export function tonePreferenceOf(memories: readonly MemoryRecord[]): TonePreference | null {
	const relevant = memories
		.filter((memory) => memory.isActive)
		.filter((memory) => memory.category === "preference")
		.filter((memory) => !STOP_TEASING_PATTERN.test(memory.content))
		.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

	for (const memory of relevant) {
		const text = memory.content;

		if (STOP_TEASING_PATTERN.test(text)) return "neutral";
		if (ROAST_PATTERN.test(text)) return "roast";
		if (PROFESSIONAL_PATTERN.test(text)) return "professional";
		if (PLAYFUL_PATTERN.test(text)) return "playful";
		if (NEUTRAL_PATTERN.test(text)) return "neutral";
	}

	return null;
}

/** Whether this person wants the sharper side. */
export function welcomesRoasting(memories: readonly MemoryRecord[]): boolean {
	return tonePreferenceOf(memories) === "roast";
}

/** Whether this person has asked for short answers. */
export function prefersShortAnswers(memories: readonly MemoryRecord[]): boolean {
	return memories.some(
		(memory) => memory.isActive && memory.category === "preference" && SHORT_PATTERN.test(memory.content),
	);
}

/** Whether this person wants the detail left out. */
export function dislikesEmojis(memories: readonly MemoryRecord[]): boolean {
	return memories.some(
		(memory) => memory.isActive && memory.category === "preference" && NO_EMOJI_PATTERN.test(memory.content),
	);
}

/** Whether this person wants long, thorough explanations. */
export function prefersDetailedAnswers(memories: readonly MemoryRecord[]): boolean {
	return memories.some(
		(memory) => memory.isActive && memory.category === "preference" && DETAILED_PATTERN.test(memory.content),
	);
}

/** Whether this person has asked not to be teased. */
export function hasStoppedTeasing(memories: readonly MemoryRecord[]): boolean {
	return memories.some(
		(memory) => memory.isActive && STOP_TEASING_PATTERN.test(memory.content),
	);
}

/**
 * The bullets that describe this person.
 *
 * The summary of each memory is used rather than its full text, because a profile is read on every
 * question and has to stay small.
 */
export function profileLines(memories: readonly MemoryRecord[], limit = 8): string[] {
	return memories
		.filter((memory) => memory.isActive)
		.filter((memory) => memory.category === "profile" || memory.category === "preference")
		.sort((a, b) => b.importance - a.importance || b.updatedAt.getTime() - a.updatedAt.getTime())
		.slice(0, limit)
		.map((memory) => memory.summary);
}
