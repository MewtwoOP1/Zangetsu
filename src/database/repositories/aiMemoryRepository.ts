import { randomUUID } from "node:crypto";
import { CACHE } from "@config/constants";
import { AiMemories, type AiMemory } from "@database/models/aiMemory.schema";
import { type MemoryRecord } from "@lib/memory/memory.types";

/** Reading and writing what the bot remembers, and the cache in front of it. */

const cache = new Map<string, { record: MemoryRecord; expiresAt: number }>();

function cacheKey(userId: string, guildId: string | null): string {
	return `${userId}:${guildId ?? "global"}`;
}

/** The live memories of one person, held briefly so a question does not read the database twice. */
export function cachedMemories(userId: string, guildId: string | null): MemoryRecord[] | null {
	const entry = cache.get(cacheKey(userId, guildId));
	if (entry === undefined || entry.expiresAt <= Date.now()) return null;
	return entry.record;
}

export function rememberMemories(userId: string, guildId: string | null, records: MemoryRecord[]): void {
	if (cache.size > CACHE.guildSettingsMaxEntries) cache.clear();
	cache.set(cacheKey(userId, guildId), { record: records, expiresAt: Date.now() + CACHE.guildSettingsTtlMs });
}

/** Every write goes through here, so a cache can never serve a memory that has just changed. */
export function clearMemoryCache(userId?: string): void {
	if (userId === undefined) {
		cache.clear();
		return;
	}

	for (const key of [...cache.keys()]) {
		if (key.startsWith(`${userId}:`)) cache.delete(key);
	}
}

export function toMemoryRecord(document: AiMemory): MemoryRecord {
	return {
		memoryId: document.memoryId,
		userId: document.userId,
		guildId: document.guildId,
		scope: document.scope,
		category: document.category,
		memoryType: document.memoryType,
		content: document.content,
		summary: document.summary,
		entities: document.entities ?? [],
		relatedMemoryIds: document.relatedMemoryIds ?? [],
		sourceMessageId: document.sourceMessageId,
		sourceChannelId: document.sourceChannelId,
		confidence: document.confidence,
		importance: document.importance,
		explicitlyRequested: document.explicitlyRequested,
		sensitivity: document.sensitivity,
		version: document.version,
		isActive: document.isActive,
		supersedesId: document.supersedesId,
		supersededById: document.supersededById,
		accessCount: document.accessCount,
		lastAccessedAt: document.lastAccessedAt,
		createdAt: document.createdAt,
		updatedAt: document.updatedAt,
	};
}

/** The live memories of one person, with the server's own shared ones. */
export async function listMemories(userId: string, guildId: string | null = null): Promise<MemoryRecord[]> {
	const cached = cachedMemories(userId, guildId);
	if (cached !== null) return cached;

	const documents = await AiMemories.find({
		userId,
		isActive: true,
		$or: [{ scope: "user" }, ...(guildId === null ? [] : [{ scope: "guild", guildId }])],
	})
		.sort({ importance: -1, updatedAt: -1 })
		.lean<AiMemory[]>()
		.exec();

	const records = documents.map(toMemoryRecord);
	rememberMemories(userId, guildId, records);
	return records;
}

/** Every memory of one person, including the ones that were replaced, for the export. */
export async function listAllMemories(userId: string, limit = 1_000): Promise<MemoryRecord[]> {
	const documents = await AiMemories.find({ userId })
		.sort({ updatedAt: -1 })
		.limit(limit)
		.lean<AiMemory[]>()
		.exec();

	return documents.map(toMemoryRecord);
}

export async function countMemories(userId: string): Promise<number> {
	return AiMemories.countDocuments({ userId, isActive: true }).exec();
}

/** One memory, but only if it belongs to the person asking. */
export async function findMemory(userId: string, memoryId: string): Promise<MemoryRecord | null> {
	const document = await AiMemories.findOne({ memoryId, userId }).lean<AiMemory | null>().exec();
	return document === null ? null : toMemoryRecord(document);
}

/** The memories that hold the same words, so a duplicate is found rather than stored twice. */
export async function findSimilarMemories(userId: string, content: string, limit = 20): Promise<MemoryRecord[]> {
	const documents = await AiMemories.find({ userId, isActive: true })
		.sort({ updatedAt: -1 })
		.limit(Math.max(limit * 4, 40))
		.lean<AiMemory[]>()
		.exec();

	return documents.map(toMemoryRecord);
}

export interface SaveMemoryInput {
	memoryId?: string;
	userId: string;
	guildId: string | null;
	scope: "user" | "guild" | "global";
	category: MemoryRecord["category"];
	memoryType: MemoryRecord["memoryType"];
	content: string;
	summary: string;
	entities: string[];
	relatedMemoryIds?: string[];
	sourceMessageId?: string | null;
	sourceChannelId?: string | null;
	confidence: number;
	importance: number;
	explicitlyRequested: boolean;
	sensitivity: MemoryRecord["sensitivity"];
	expiresAt?: Date | null;
	supersedesId?: string | null;
}

/** Writes one memory, creating it when it is new. */
export async function saveMemory(input: SaveMemoryInput): Promise<MemoryRecord> {
	const memoryId = input.memoryId ?? randomUUID();
	const now = new Date();

	const document = await AiMemories.findOneAndUpdate(
		{ memoryId, userId: input.userId },
		{
			$set: {
				guildId: input.guildId,
				scope: input.scope,
				category: input.category,
				memoryType: input.memoryType,
				content: input.content,
				summary: input.summary,
				entities: input.entities,
				relatedMemoryIds: input.relatedMemoryIds ?? [],
				sourceMessageId: input.sourceMessageId ?? null,
				sourceChannelId: input.sourceChannelId ?? null,
				confidence: input.confidence,
				importance: input.importance,
				explicitlyRequested: input.explicitlyRequested,
				sensitivity: input.sensitivity,
				expiresAt: input.expiresAt ?? null,
				supersedesId: input.supersedesId ?? null,
				isActive: true,
				lastAccessedAt: now,
			},
			$inc: { version: 1 },
		},
		{ upsert: true, new: true, lean: true, setDefaultsOnInsert: true },
	).exec();

	clearMemoryCache(input.userId);
	return toMemoryRecord(document as AiMemory);
}

/** Marks a memory as replaced by a newer one, so it stops being retrieved but is not lost. */
export async function supersedeMemory(memoryId: string, supersededById: string, userId: string): Promise<void> {
	await AiMemories.updateOne(
		{ memoryId, userId },
		{ $set: { isActive: false, supersededById } },
	).exec();

	clearMemoryCache(userId);
}

/** Points a memory at the one that replaced it, so the history stays readable. */
export async function linkSuperseding(memoryId: string, supersedesId: string, userId: string): Promise<void> {
	await AiMemories.updateOne({ memoryId, userId }, { $set: { supersedesId } }).exec();
	clearMemoryCache(userId);
}

/** Records that a memory was used, so the ones that matter show it. */
export async function touchMemories(memoryIds: readonly string[]): Promise<void> {
	if (memoryIds.length === 0) return;

	await AiMemories.updateMany(
		{ memoryId: { $in: [...memoryIds] } },
		{ $set: { lastAccessedAt: new Date() }, $inc: { accessCount: 1 } },
	).exec();
}

/** Removes one memory for good. */
export async function deleteMemory(userId: string, memoryId: string): Promise<boolean> {
	const result = await AiMemories.deleteOne({ memoryId, userId }).exec();
	clearMemoryCache(userId);
	return result.deletedCount > 0;
}

/** Removes every memory of one person, for good. */
export async function deleteMemories(userId: string): Promise<number> {
	const result = await AiMemories.deleteMany({ userId }).exec();
	clearMemoryCache(userId);
	return result.deletedCount;
}

/** The tests start from nothing. */
export function resetMemoryCache(): void {
	cache.clear();
}
