/** One answer the assistant can give about the Zangetsu app, and where it came from. */

/** Where a question sits in the app's support surface. */
export type KnowledgeTopic =
	| "install"
	| "sources"
	| "playback"
	| "library"
	| "reading"
	| "accounts"
	| "tv"
	| "settings"
	| "errors"
	| "updates"
	| "troubleshooting";

/** How the answer was established. Official documentation outranks everything else. */
export type KnowledgeSourceType = "official" | "maintainer" | "community";

/** How sure the answer is. A community report nobody confirmed is never high. */
export type KnowledgeConfidence = "high" | "medium" | "low";

/** Which build the answer applies to. */
export type KnowledgePlatform = "android" | "android-tv" | "ios" | "any";

export interface KnowledgeEntry {
	id: string;
	title: string;
	topic: KnowledgeTopic;
	platform: KnowledgePlatform;
	/** The app versions this was checked against, written as the maintainers write them. */
	versions: string;
	keywords: string[];
	/** The ways a member might ask for this, which carry the weight of the title. */
	questions: string[];
	/** Exact text of an error this entry explains, so the question can be matched against it. */
	errorStrings: string[];
	sourceUrl: string;
	sourceType: KnowledgeSourceType;
	/** ISO date the answer was last checked against its source. */
	checkedAt: string;
	confidence: KnowledgeConfidence;
	/** True when the source has moved on and the answer may no longer hold. */
	outdated: boolean;
	/** The answer itself, in the Markdown subset Discord renders. */
	body: string;
}

export interface KnowledgeHit {
	entry: KnowledgeEntry;
	score: number;
	/** How much of the question's weight this entry matched, from 0 to 1. */
	coverage: number;
	/** The error text in the question that this entry explains, when one matched exactly. */
	matchedError: string | null;
}

/** What the assistant could establish about the question before it looked anything up. */
export interface QuestionContext {
	platform: KnowledgePlatform;
	topic: KnowledgeTopic | null;
	/** The error text in the question, when it quotes one. */
	error: string | null;
	/** True when the question asks about something that changes over time. */
	asksForCurrentInformation: boolean;
}
