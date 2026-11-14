/** The two projects called Zangetsu, the fixed facts about them, and the bounds on a retrieved answer. */

export const KNOWLEDGE_TOPICS = [
	"install",
	"sources",
	"playback",
	"library",
	"reading",
	"accounts",
	"tv",
	"settings",
	"errors",
	"updates",
	"troubleshooting",
] as const;

export const KNOWLEDGE_SOURCE_TYPES = ["official", "maintainer", "community"] as const;

export const KNOWLEDGE_CONFIDENCES = ["high", "medium", "low"] as const;

export const KNOWLEDGE_PLATFORMS = ["android", "android-tv", "ios", "any"] as const;

/** The upstream app project. Everything about the app itself comes from here and from its guide. */
export const APP_REPOSITORY = "Spyou/Zangetsu";

/** This bot's own project. It is not the app, and support questions about the app are not about it. */
export const BOT_REPOSITORY = "MewtwoOP1/Zangetsu";

export const APP_REPOSITORY_URL = `https://github.com/${APP_REPOSITORY}`;

export const APP_RELEASES_URL = `${APP_REPOSITORY_URL}/releases`;

export const OFFICIAL_SITE_URL = "https://zangetsu.online/";

export const OFFICIAL_GUIDE_URL = "https://zangetsu.online/guide/";

export const KNOWLEDGE_LIMITS = {
	/** How many entries reach the model with one question. */
	retrieved: 5,
	/** Characters of one entry's answer, so one long page cannot crowd the others out. */
	bodyChars: 1_800,
	/** Characters of retrieved knowledge in one prompt. */
	totalChars: 9_000,
	/** How many community reports may be kept from one refresh, so a noisy forum cannot flood the corpus. */
	communityEntries: 40,
	/** How long a fetched page stays fresh before it is fetched again. */
	snapshotTtlMs: 6 * 60 * 60_000,
	/** How long a release feed stays fresh before it is fetched again. */
	releaseTtlMs: 60 * 60_000,
	/** The shortest gap between two refreshes, so a question cannot start a burst of fetches. */
	minRefreshGapMs: 10 * 60_000,
} as const;
