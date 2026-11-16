/** The memory system's vocabulary: what a memory is, and what may be done with one. */

/** Which layer a memory belongs to. */
export type MemoryCategory = "profile" | "preference" | "project" | "event" | "knowledge" | "task";

/** What kind of thing the memory holds. */
export type MemoryType =
	| "fact"
	| "preference"
	| "skill"
	| "setup"
	| "decision"
	| "event"
	| "task"
	| "solution"
	| "term"
	| "relationship";

/** Who the memory belongs to. */
export type MemoryScope = "user" | "guild" | "global";

/** How private the memory is. */
export type MemorySensitivity = "normal" | "private" | "sensitive";

/** One stored memory. */
export interface MemoryRecord {
	memoryId: string;
	userId: string;
	guildId: string | null;
	scope: MemoryScope;
	category: MemoryCategory;
	memoryType: MemoryType;
	/** The memory in full. */
	content: string;
	/** The compact form that reaches the model. */
	summary: string;
	entities: string[];
	relatedMemoryIds: string[];
	sourceMessageId: string | null;
	sourceChannelId: string | null;
	/** How sure the memory is that this is true. */
	confidence: number;
	/** How much it matters for the future. */
	importance: number;
	/** The person asked for this one to be kept. */
	explicitlyRequested: boolean;
	sensitivity: MemorySensitivity;
	/** Bumped every time the memory's content changes. */
	version: number;
	isActive: boolean;
	/** The memory this one replaced. */
	supersedesId: string | null;
	/** The memory that replaced this one. */
	supersededById: string | null;
	accessCount: number;
	lastAccessedAt: Date;
	createdAt: Date;
	updatedAt: Date;
}

/** What the extraction model proposed. */
export interface MemoryCandidate {
	content: string;
	category: MemoryCategory;
	memoryType: MemoryType;
	/** Who it belongs to: theirs alone, or shared with the server. */
	scope: "user" | "guild";
	confidence: number;
	importance: number;
	entities: string[];
	explicitlyRequested: boolean;
	sensitivity: MemorySensitivity;
	/** The person corrected something rather than adding to it. */
	isCorrection: boolean;
	/** The text the candidate replaces, when the model could point at it. */
	supersedesSummary: string | null;
}

/** A memory together with how well it matches what was asked. */
export interface RankedMemory {
	memory: MemoryRecord;
	score: number;
	reason: string;
}

/** Why a candidate was not kept. */
export type MemoryRejection =
	| "hypothetical"
	| "temporary"
	| "joke"
	| "sarcasm"
	| "unverified"
	| "too-short"
	| "too-long"
	| "duplicate"
	| "sensitive";

/** The tone a person has said they want. */
export type TonePreference = "roast" | "playful" | "neutral" | "professional";
