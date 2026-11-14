import { knowledgeEntries } from "@lib/knowledge/knowledgeArticles.util";
import { retrieveKnowledge } from "@lib/knowledge/knowledgeSearch.util";
import { type KnowledgeEntry } from "@lib/knowledge/knowledge.types";

/** The questions members actually ask, and the entry each one has to reach. */

const entries = knowledgeEntries();

interface Case {
	question: string;
	/** The entry that has to be in the answer. */
	expect: string;
	note?: string;
}

const CASES: Case[] = [
	{ question: "Why is the app empty after installation?", expect: "empty-home-after-install" },
	{ question: "How do I add a repository?", expect: "how-to-add-a-repository" },
	{ question: "Which APK should I download?", expect: "which-apk-to-download" },
	{ question: "Does Zangetsu support Android TV?", expect: "android-tv-installation" },
	{ question: "Why does a source return no playable servers?", expect: "source-no-playable-servers" },
	{ question: "Why does playback keep buffering?", expect: "infinite-buffering" },
	{ question: "What does a Cloudflare challenge mean?", expect: "cloudflare-challenge" },
	{ question: "How do I fix missing subtitles?", expect: "subtitles-and-sync" },
	{ question: "How do I update extensions?", expect: "how-to-update-extensions" },
	{ question: "How do I update the app?", expect: "updating-the-app" },
	{ question: "Can I watch downloaded episodes offline?", expect: "downloads-and-offline" },
	{ question: "How do I connect AniList?", expect: "anilist-and-trackers" },
	{ question: "How do I sign in to a TV using a QR code?", expect: "tv-qr-sign-in" },
	{
		question: "What is the difference between native Zangetsu sources and other extension formats?",
		expect: "native-zangetsu-sources",
	},
	{ question: "Which version fixed my problem?", expect: "checking-release-notes" },
	{ question: "How do I report a bug?", expect: "bug-report-checklist" },
	{ question: "Why does a browser window open when I press play?", expect: "browser-window-on-play" },
	{ question: "Why does the app crash on launch?", expect: "install-failed-wrong-architecture" },
	{ question: "How do I cast to a Chromecast?", expect: "casting-chromecast" },
	{ question: "Can I use it on an iPhone?", expect: "ios-availability" },
	{ question: "How do I read manga offline?", expect: "reading-and-downloads" },
	{ question: "Why are there no subtitles on my TV?", expect: "subtitles-and-sync" },
	{ question: "How do I know which sources are dead?", expect: "source-health" },
	{ question: "Is this a bug in the app or in my source?", expect: "source-problem-or-app-problem" },
	{ question: "Why is the video black but I can hear sound?", expect: "black-screen" },
	{ question: "How do I update my sources?", expect: "how-to-update-extensions" },
	{ question: "Where do my downloads get saved?", expect: "storage-and-downloads-settings" },
	{ question: "What does Incognito mode do?", expect: "incognito-and-privacy" },
	{ question: "Why is it playing the wrong episode?", expect: "wrong-episode-or-title" },
	{ question: "How do I use the remote on my TV?", expect: "tv-remote-navigation" },
	{ question: "What does Auto Resolve do?", expect: "auto-resolve" },
	{ question: "Why does the search find nothing?", expect: "search-and-catalogue" },
	{ question: "Can I watch movies on it?", expect: "movies-and-tv" },
	{ question: "How do I make a profile with a PIN?", expect: "profiles-and-pins" },
	{ question: "The video link will not open. What do I do?", expect: "playback-failure" },
	{ question: "Why is season 2 episode 1 numbered 14?", expect: "seasons-and-episode-order" },
	{ question: "It only happens on my phone, not my TV.", expect: "device-specific-problems" },
	{ question: "What permissions does it want?", expect: "app-permissions" },
	{ question: "Where do I change the subtitle size?", expect: "display-and-appearance" },
	{ question: "How do I make a light novel an EPUB?", expect: "epub-and-novel-formats" },
];

describe("the question suite members actually ask", () => {
	it.each(CASES)("$question reaches $expect", ({ question, expect: expected }) => {
		const hits = retrieveKnowledge(question, { entries });

		expect(hits.map((hit) => hit.entry.id)).toContain(expected);
	});

	it("answers every question in the suite", () => {
		const unanswered = CASES.filter(({ question, expect: expected }) => {
			const hits = retrieveKnowledge(question, { entries });
			return !hits.some((hit) => hit.entry.id === expected);
		});

		expect(unanswered.map((entry) => entry.question)).toEqual([]);
	});
});

describe("questions the assistant must not fake an answer to", () => {
	it("returns nothing for a question about the capital of France", () => {
		expect(retrieveKnowledge("what is the capital of France", { entries })).toHaveLength(0);
	});

	it("returns nothing for a question about an unrelated application", () => {
		expect(retrieveKnowledge("how do I set up Plex on my NAS", { entries })).toHaveLength(0);
	});

	it("returns nothing for a question about the Bleach character", () => {
		expect(retrieveKnowledge("who is Zangetsu in Bleach", { entries })).toHaveLength(0);
	});

	it("returns nothing for a question about the Discord bot's own commands", () => {
		expect(retrieveKnowledge("how do I ban a member with the slash command", { entries })).toHaveLength(0);
	});

	it("does not answer a version question with a version", () => {
		const hits = retrieveKnowledge("is there a newer version available", { entries });

		for (const hit of hits) {
			expect(hit.entry.body).not.toMatch(/the latest version is v\d/i);
		}
	});
});

describe("answers that may be out of date", () => {
	it("marks an entry that its source has moved past", () => {
		const stale: KnowledgeEntry[] = [
			{
				id: "old",
				title: "An old answer",
				topic: "install",
				platform: "any",
				versions: "v1.0.0",
				keywords: ["ancient"],
				questions: ["an ancient question?"],
				errorStrings: [],
				sourceUrl: "https://example.com/guide",
				sourceType: "official",
				checkedAt: "2020-01-01",
				confidence: "medium",
				outdated: true,
				body: "Something that changed.",
			},
		];

		const hits = retrieveKnowledge("an ancient question", { entries: stale });

		expect(hits[0]?.entry.outdated).toBe(true);
	});
});
