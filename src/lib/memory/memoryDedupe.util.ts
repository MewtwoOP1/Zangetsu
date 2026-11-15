import { MEMORY_LIMITS } from "@lib/memory/memory.constants";
import { type MemoryCandidate, type MemoryRecord } from "@lib/memory/memory.types";
import { keywordsOf } from "@lib/memory/memoryScore.util";

/** Telling one memory from a copy of it, and telling a correction from an addition. */

/** The words of a memory, with the noise taken out so two phrasings can be compared. */
export function normaliseForCompare(text: string): Set<string> {
	return new Set(keywordsOf(text));
}

/** How alike two pieces of text are, from nothing to one. */
export function similarity(left: string, right: string): number {
	const a = normaliseForCompare(left);
	const b = normaliseForCompare(right);
	if (a.size === 0 || b.size === 0) return 0;

	let shared = 0;
	for (const word of a) {
		if (b.has(word)) shared += 1;
	}

	return (2 * shared) / (a.size + b.size);
}

/** Whether two memories say the same thing. */
export function isDuplicate(left: string, right: string, threshold = MEMORY_LIMITS.dedupeThreshold): boolean {
	return similarity(left, right) >= threshold;
}

/**
 * The slot a memory sits in.
 *
 * Two memories about the same device or the same project share a slot, which is how a later statement
 * is recognised as replacing an earlier one.
 */
export function memorySlot(memory: Pick<MemoryRecord, "category" | "entities">): string {
	const entities = memory.entities
		.map((entity) => entity.toLowerCase().trim())
		.filter((entity) => entity !== "")
		.sort();

	return `${memory.category}:${entities.join("|")}`;
}

/** The memory a candidate replaces, or null when it adds something new. */
export function findSuperseding(
	existing: readonly MemoryRecord[],
	candidate: MemoryCandidate,
): { memory: MemoryRecord; reason: "named" | "correction" | "duplicate" } | null {
	// The model pointed at the memory it replaces.
	if (candidate.supersedesSummary !== null && candidate.supersedesSummary.trim() !== "") {
		const named = existing
			.filter((memory) => memory.isActive)
			.map((memory) => ({
				memory,
				score: similarity(memory.content, candidate.supersedesSummary ?? ""),
			}))
			.sort((a, b) => b.score - a.score)[0];

		if (named !== undefined && named.score >= 0.4) {
			return { memory: named.memory, reason: "named" };
		}
	}

	// The candidate says it is a correction, and an older memory sits in the same slot.
	if (candidate.isCorrection) {
		const slot = `${candidate.category}:${[...candidate.entities]
			.map((entity) => entity.toLowerCase().trim())
			.sort()
			.join("|")}`;
		const sameSlot = existing
			.filter((memory) => memory.isActive && memorySlot(memory) === slot)
			.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

		const [latest] = sameSlot;
		if (latest !== undefined) return { memory: latest, reason: "correction" };
	}

	// The candidate says the same thing as something already stored.
	const duplicate = existing
		.filter((memory) => memory.isActive)
		.map((memory) => ({ memory, score: similarity(memory.content, candidate.content) }))
		.sort((a, b) => b.score - a.score)[0];

	if (duplicate !== undefined && duplicate.score >= MEMORY_LIMITS.dedupeThreshold) {
		return { memory: duplicate.memory, reason: "duplicate" };
	}

	return null;
}

/**
 * The content a stored memory should carry after a candidate was folded into it.
 *
 * A duplicate is folded in without losing what was already there, and a correction replaces it outright.
 */
export function mergedContent(existing: string, candidate: string, reason: "named" | "correction" | "duplicate"): string {
	if (reason === "duplicate") {
		// Two phrasings of one fact: the longer one usually carries more of it.
		return candidate.length > existing.length ? candidate.trim() : existing.trim();
	}
	return candidate.trim();
}
