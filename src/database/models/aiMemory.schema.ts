import { model, Schema } from "mongoose";

/** One remembered thing about one person, or one shared fact the server learned. */

export interface AiMemory {
	memoryId: string;
	/** The person the memory belongs to. A shared memory keeps the person who introduced it. */
	userId: string;
	guildId: string | null;
	/** `user` is theirs alone, `guild` is shared with the server. */
	scope: "user" | "guild" | "global";
	category: "profile" | "preference" | "project" | "event" | "knowledge" | "task";
	memoryType:
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
	/** The memory in full. */
	content: string;
	/** The compact form that reaches the model. */
	summary: string;
	entities: string[];
	relatedMemoryIds: string[];
	sourceMessageId: string | null;
	sourceChannelId: string | null;
	/** How sure this is that the memory is true. */
	confidence: number;
	/** How much it matters for the future. */
	importance: number;
	/** The person asked for this one to be kept. */
	explicitlyRequested: boolean;
	sensitivity: "normal" | "private" | "sensitive";
	/** Bumped every time the content changes. */
	version: number;
	isActive: boolean;
	/** The memory this one replaced. */
	supersedesId: string | null;
	/** The memory that replaced this one. */
	supersededById: string | null;
	/** When a temporary memory stops being true. A durable memory never expires. */
	expiresAt: Date | null;
	accessCount: number;
	lastAccessedAt: Date;
	createdAt: Date;
	updatedAt: Date;
}

const aiMemorySchema = new Schema<AiMemory>(
	{
		memoryId: { type: String, required: true, unique: true },
		userId: { type: String, required: true },
		guildId: { type: String, default: null },
		scope: { type: String, required: true, default: "user" },
		category: { type: String, required: true },
		memoryType: { type: String, required: true },
		content: { type: String, required: true },
		summary: { type: String, required: true },
		entities: { type: [String], required: true, default: [] },
		relatedMemoryIds: { type: [String], required: true, default: [] },
		sourceMessageId: { type: String, default: null },
		sourceChannelId: { type: String, default: null },
		confidence: { type: Number, required: true, default: 0.6, min: 0, max: 1 },
		importance: { type: Number, required: true, default: 0.5, min: 0, max: 1 },
		explicitlyRequested: { type: Boolean, required: true, default: false },
		sensitivity: { type: String, required: true, default: "normal" },
		version: { type: Number, required: true, default: 1 },
		isActive: { type: Boolean, required: true, default: true },
		supersedesId: { type: String, default: null },
		supersededById: { type: String, default: null },
		expiresAt: { type: Date, default: null },
		accessCount: { type: Number, required: true, default: 0 },
		lastAccessedAt: { type: Date, required: true, default: Date.now },
	},
	{ timestamps: true },
);

// The common read: one person's live memories, best first.
aiMemorySchema.index({ userId: 1, isActive: 1, importance: -1, updatedAt: -1 });
// The other common read: one person's memories of one kind.
aiMemorySchema.index({ userId: 1, category: 1, updatedAt: -1 });
// A shared memory is found by the server it belongs to.
aiMemorySchema.index({ guildId: 1, scope: 1, isActive: 1 });
// The memories that are about the same thing.
aiMemorySchema.index({ relatedMemoryIds: 1 });
// A temporary memory disappears on its own; a durable one has no date and is never touched by this.
aiMemorySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, partialFilterExpression: { expiresAt: { $type: "date" } } });
// A full-text search over what was said, for the search command.
aiMemorySchema.index({ content: "text", summary: "text" });

export const AiMemories = model<AiMemory>("aimemories", aiMemorySchema);
