import { MEMORY_LIMITS } from "@lib/memory/memory.constants";
import { type MemoryRecord } from "@lib/memory/memory.types";

/** How much a memory matters, how well it matches what was asked, and how hard it is to let go of. */

/** Four characters per token is close enough to budget a prompt with. */
export function estimateTokens(text: string): number {
	return Math.ceil(text.length / 4);
}

const STOP_WORDS = new Set(
	(
		"a about after all also am an and any are as at be been being but by can could did do does doing for from get " +
		"got had has have how i if in into is it its just me my no not of on once only or our out over please she should " +
		"so some than that the their them then there these they this those to too up us use used was we were what when " +
		"where which while who why will with would you your am im dont thats thats"
	).split(" "),
);

/** The words in a text that carry meaning. */
export function keywordsOf(text: string): string[] {
	return [
		...new Set(
			text
				.normalize("NFKD")
				.replace(/\p{M}/gu, "")
				.toLowerCase()
				.replace(/['’]/g, "")
				.split(/[^a-z0-9+#.]+/)
				.map((word) => word.replace(/^\.+|\.+$/g, ""))
				.filter((word) => word.length > 2 && !STOP_WORDS.has(word)),
		),
	];
}

export interface ImportanceSignals {
	/** The person asked for this one to be kept. */
	explicit: boolean;
	/** How sure we are that it is true. */
	confidence: number;
	/** The model's own estimate of how much it will matter. */
	importance: number;
	/** It corrects something the person said before. */
	isCorrection: boolean;
	/** It belongs to something the person is working on. */
	linkedToProject: boolean;
	/** The person has said something like this before. */
	repetition: number;
	/** How recent the conversation was that produced it. */
	recency: number;
}

/**
 * How much a memory is worth keeping.
 *
 * A memory the person asked for is kept whatever else it scores, because they asked for it. Everything
 * else is a blend, so that a confident and relevant fact beats a vague one and a correction beats both.
 */
export function importanceScore(signals: ImportanceSignals): number {
	if (signals.explicit) return 1;

	const confidence = clamp(signals.confidence);
	const stated = clamp(signals.importance);
	const repetition = clamp(signals.repetition / 3);
	const recency = clamp(signals.recency);
	const bonus = (signals.isCorrection ? 0.15 : 0) + (signals.linkedToProject ? 0.1 : 0);

	const score = stated * 0.45 + confidence * 0.25 + repetition * 0.1 + recency * 0.1 + bonus;
	return clamp(score);
}

/**
 * How well a memory matches what was asked.
 *
 * The words of the question matter most, the entities the memory names matter next, and a memory that
 * belongs to the same project is worth something even when the words do not line up.
 */
export function relevanceScore(memory: MemoryRecord, query: string, queryEntities: readonly string[] = []): number {
	const wanted = keywordsOf(query);
	if (wanted.length === 0) return 0;

	const text = `${memory.content} ${memory.summary} ${memory.entities.join(" ")}`;
	const have = new Set(keywordsOf(text));

	let matched = 0;
	for (const word of wanted) {
		if (have.has(word)) matched += 1;
	}
	const coverage = matched / wanted.length;
	if (coverage === 0) return 0;

	let entityHits = 0;
	for (const entity of queryEntities) {
		if (memory.entities.some((candidate) => candidate.toLowerCase() === entity.toLowerCase())) entityHits += 1;
	}
	const entityScore = queryEntities.length === 0 ? 0 : entityHits / queryEntities.length;

	const importance = clamp(memory.importance);
	const ageDays = (Date.now() - memory.updatedAt.getTime()) / 86_400_000;
	const recency = Math.max(0, 1 - ageDays / 365);

	return clamp(coverage * 0.62 + entityScore * 0.18 + importance * 0.12 + recency * 0.08);
}

/**
 * How strongly a memory should be held on to.
 *
 * An explicitly requested memory outranks everything, and an important one is never dropped for being
 * quiet. Recency only ever adds; it never removes.
 */
export function retentionPriority(memory: MemoryRecord): number {
	if (memory.explicitlyRequested) return 1;

	const importance = clamp(memory.importance);
	const confidence = clamp(memory.confidence);
	const ageDays = (Date.now() - memory.updatedAt.getTime()) / 86_400_000;
	const recency = Math.max(0, 1 - ageDays / 365);

	return clamp(importance * 0.62 + confidence * 0.18 + recency * 0.2);
}

/** Whether a memory is worth keeping at all once the queue is full. */
export function isRetained(memory: MemoryRecord): boolean {
	return memory.isActive && memory.importance >= MEMORY_LIMITS.minImportance;
}

function clamp(value: number): number {
	if (!Number.isFinite(value)) return 0;
	return Math.min(1, Math.max(0, value));
}
