import { MEMORY_LIMITS } from "@lib/memory/memory.constants";
import { findSuperseding, mergedContent } from "@lib/memory/memoryDedupe.util";
import { importanceScore } from "@lib/memory/memoryScore.util";
import { type MemoryCandidate, type MemoryRecord } from "@lib/memory/memory.types";
import {
	clearMemoryCache,
	deleteMemories,
	deleteMemory,
	findMemory,
	listMemories,
	linkSuperseding,
	saveMemory,
	supersedeMemory,
} from "@database/repositories/aiMemoryRepository";

/** The one path a memory takes to be written, and the one path it takes to be removed. */

export interface RememberContext {
	userId: string;
	guildId: string | null;
	sourceMessageId?: string | null;
	sourceChannelId?: string | null;
	/** How many times this person has said something like it before. */
	repetition?: number;
	/** Whether it belongs to something they are working on. */
	linkedToProject?: boolean;
	/** How recent the conversation was. */
	recency?: number;
}

export interface RememberResult {
	/** What happened to this candidate. */
	outcome: "created" | "updated" | "superseded" | "rejected";
	/** The memory that now holds it, when there is one. */
	memory: MemoryRecord | null;
	/** Why it was not kept, when it was not. */
	reason: string;
}

/** The short form of a memory, which is what reaches the model. */
export function summarise(content: string, limit = MEMORY_LIMITS.summaryChars): string {
	const trimmed = content.trim().replace(/\s+/g, " ");
	if (trimmed.length <= limit) return trimmed;

	const cut = trimmed.slice(0, limit);
	const lastSpace = cut.lastIndexOf(" ");
	return `${(lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/**
 * Writes one candidate, deciding whether it is new, a correction, or a copy of something already stored.
 *
 * Nothing is written twice: a candidate that says the same thing as a stored memory updates that memory
 * instead, and a correction replaces the memory it corrects while keeping the old one readable.
 */
export async function rememberCandidate(
	candidate: MemoryCandidate,
	context: RememberContext,
): Promise<RememberResult> {
	const existing = await listMemories(context.userId, context.guildId);
	const match = findSuperseding(existing, candidate);

	if (match !== null) {
		const content = mergedContent(match.memory.content, candidate.content, match.reason);
		const importance = importanceScore({
			explicit: candidate.explicitlyRequested,
			confidence: candidate.confidence,
			importance: candidate.importance,
			isCorrection: candidate.isCorrection,
			linkedToProject: context.linkedToProject ?? false,
			repetition: context.repetition ?? 0,
			recency: context.recency ?? 1,
		});

		const memory = await saveMemory({
			memoryId: match.memory.memoryId,
			userId: context.userId,
			guildId: context.guildId,
			scope: match.memory.scope,
			category: candidate.category,
			memoryType: candidate.memoryType,
			content,
			summary: summarise(content),
			entities: candidate.entities.length > 0 ? candidate.entities : match.memory.entities,
			relatedMemoryIds: match.memory.relatedMemoryIds,
			sourceMessageId: context.sourceMessageId ?? null,
			sourceChannelId: context.sourceChannelId ?? null,
			confidence: Math.max(match.memory.confidence, candidate.confidence),
			importance: Math.max(match.memory.importance, importance),
			explicitlyRequested: match.memory.explicitlyRequested || candidate.explicitlyRequested,
			sensitivity: candidate.sensitivity,
			supersedesId: match.reason === "correction" ? match.memory.memoryId : match.memory.supersedesId,
		});

		if (match.reason === "correction" || match.reason === "named") {
			await supersedeMemory(match.memory.memoryId, memory.memoryId, context.userId);
			await linkSuperseding(memory.memoryId, match.memory.memoryId, context.userId);
			return { outcome: "superseded", memory, reason: "it replaces something said earlier" };
		}

		return { outcome: "updated", memory, reason: "it said the same thing as something already stored" };
	}

	const importance = importanceScore({
		explicit: candidate.explicitlyRequested,
		confidence: candidate.confidence,
		importance: candidate.importance,
		isCorrection: candidate.isCorrection,
		linkedToProject: context.linkedToProject ?? false,
		repetition: context.repetition ?? 0,
		recency: context.recency ?? 1,
	});

	const memory = await saveMemory({
		userId: context.userId,
		guildId: context.guildId,
		scope: candidate.scope,
		category: candidate.category,
		memoryType: candidate.memoryType,
		content: candidate.content,
		summary: summarise(candidate.content),
		entities: candidate.entities,
		confidence: candidate.confidence,
		importance,
		explicitlyRequested: candidate.explicitlyRequested,
		sensitivity: candidate.sensitivity,
	});

	return { outcome: "created", memory, reason: "new" };
}

/**
 * Stores something the person asked to be remembered.
 *
 * An explicit request is kept whatever it scores, and it always outranks the rules that would throw
 * an ordinary sentence away.
 */
export async function rememberExplicit(
	content: string,
	context: RememberContext & { entities?: string[]; memoryType?: MemoryRecord["memoryType"] },
): Promise<RememberResult> {
	const trimmed = content.trim();
	if (trimmed === "") return { outcome: "rejected", memory: null, reason: "there was nothing to remember" };

	const candidate: MemoryCandidate = {
		content: trimmed,
		category: "profile",
		memoryType: context.memoryType ?? "fact",
		scope: "user",
		confidence: 1,
		importance: 1,
		entities: context.entities ?? [],
		explicitlyRequested: true,
		sensitivity: "normal",
		isCorrection: false,
		supersedesSummary: null,
	};

	return rememberCandidate(candidate, context);
}

/** Removes one memory, and only one this person owns. */
export async function forgetMemory(userId: string, memoryId: string): Promise<boolean> {
	const memory = await findMemory(userId, memoryId);
	if (memory === null) return false;

	return deleteMemory(userId, memoryId);
}

/** Removes every memory of one person. */
export async function forgetEverything(userId: string): Promise<number> {
	return deleteMemories(userId);
}

/** The cache is dropped when memories change, so a read never serves something that has gone. */
export function invalidateMemoryCache(): void {
	clearMemoryCache();
}
