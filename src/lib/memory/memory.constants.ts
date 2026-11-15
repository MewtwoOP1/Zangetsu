/** The memory system's vocabulary, in values: the categories, the limits and the wording. */

/** The three layers, plus the two kinds of memory that are neither a fact nor an event. */
export const MEMORY_CATEGORIES = ["profile", "preference", "project", "event", "knowledge", "task"] as const;

export const MEMORY_TYPES = [
	"fact",
	"preference",
	"skill",
	"setup",
	"decision",
	"event",
	"task",
	"solution",
	"term",
	"relationship",
] as const;

export const MEMORY_SCOPES = ["user", "guild", "global"] as const;

export const MEMORY_SENSITIVITIES = ["normal", "private", "sensitive"] as const;

/** The words that name each category, for the extraction model and for the commands. */
export const MEMORY_CATEGORY_LABELS: Record<string, string> = {
	profile: "Profile",
	preference: "Preference",
	project: "Project",
	event: "Event",
	knowledge: "Knowledge",
	task: "Task",
};

export const MEMORY_TYPE_LABELS: Record<string, string> = {
	fact: "Fact",
	preference: "Preference",
	skill: "Skill",
	setup: "Setup",
	decision: "Decision",
	event: "Event",
	task: "Task",
	solution: "Solution",
	term: "Term",
	relationship: "Relationship",
};

export const MEMORY_LIMITS = {
	/** How many memories reach the model with one question. */
	retrievalLimit: 12,
	/** Characters of retrieved memory in one prompt, so a long history cannot crowd out the answer. */
	contextBudgetChars: 2_600,
	/** Characters of one memory's summary. */
	summaryChars: 280,
	/** Characters of one memory's full text. */
	contentChars: 1_200,
	/** How many memories one person may keep. */
	maxPerUser: 500,
	/** How many candidates one extraction may propose. */
	maxCandidates: 8,
	/** How similar two memories must be to count as the same one. */
	dedupeThreshold: 0.82,
	/** Below this a memory is not worth keeping. */
	minImportance: 0.25,
	/** Below this a memory is not confident enough to act on. */
	minConfidence: 0.3,
	/** How long a retrieved memory stays in the in-process cache. */
	cacheTtlMs: 5 * 60_000,
	/** How many people the cache holds at once. */
	cacheMaxEntries: 500,
	/** How long the extraction queue waits before it gives up on a batch. */
	extractionTimeoutMs: 20_000,
	/** How many extractions may be waiting at once. */
	maxQueuedExtractions: 200,
	/** How many memories one export holds. */
	maxExport: 1_000,
} as const;

/** The words that ask for a memory to be kept, or for the bot to stop teasing. */
export const MEMORY_SAVE_PHRASES = [
	"remember that",
	"remember this",
	"remember i",
	"keep in mind",
	"note that",
	"don't forget",
	"do not forget",
	"memorise",
	"memorize",
	"save this",
	"store this",
	"remember my",
	"remember when",
	"remember what",
	"for future reference",
];

export const MEMORY_FORGET_PHRASES = [
	"forget that",
	"forget this",
	"forget what",
	"forget my",
	"forget about",
	"delete that memory",
	"delete this memory",
	"remove that memory",
	"erase that memory",
	"wipe my memory",
	"erase my memory",
	"delete my memories",
];

export const NO_ROAST_PHRASES = [
	"stop teasing",
	"stop roasting",
	"stop the roasting",
	"stop being mean",
	"be serious",
	"be nice",
	"be serious now",
	"don't roast me",
	"do not roast me",
	"no more jokes",
	"stop joking",
	"stop the jokes",
	"serious mode",
	"cut the jokes",
];

/** The words that invite the sharper side. */
export const ROAST_INVITATIONS = [
	"roast me",
	"roast me harder",
	"roast me again",
	"hit me with your worst",
	"insult me",
	"roast",
	"be mean to me",
	"roast my",
	"destroy me",
	"be brutal",
	"no holds barred",
	"uncensored",
	"unfiltered",
	"be mean",
];
