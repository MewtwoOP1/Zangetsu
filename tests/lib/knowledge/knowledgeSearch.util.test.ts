import { knowledgeEntries } from "@lib/knowledge/knowledgeArticles.util";
import {
	asksForCurrentInformation,
	detectError,
	detectPlatform,
	detectTopic,
	retrieveKnowledge,
} from "@lib/knowledge/knowledgeSearch.util";
import { type KnowledgeEntry } from "@lib/knowledge/knowledge.types";

const entries = knowledgeEntries();

function idsFor(question: string): string[] {
	return retrieveKnowledge(question, { entries }).map((hit) => hit.entry.id);
}

describe("reading what a question is about", () => {
	it("tells a TV question from a phone question and an iOS question", () => {
		expect(detectPlatform("how do I sign in on my android tv")).toBe("android-tv");
		expect(detectPlatform("does it work on a firestick")).toBe("android-tv");
		expect(detectPlatform("is there an iphone version")).toBe("ios");
		expect(detectPlatform("which apk for my phone")).toBe("android");
		expect(detectPlatform("what is zangetsu")).toBe("any");
	});

	it("finds the topic a question belongs to", () => {
		expect(detectTopic("how do I add a repository")).toBe("sources");
		expect(detectTopic("why does it keep buffering")).toBe("playback");
		expect(detectTopic("which apk should I install")).toBe("install");
		expect(detectTopic("how do I connect anilist")).toBe("accounts");
		expect(detectTopic("how do I read manga offline")).toBe("reading");
	});

	it("knows a question about right now from one about the manual", () => {
		expect(asksForCurrentInformation("is zangetsu down right now")).toBe(true);
		expect(asksForCurrentInformation("is this bug fixed in the latest version")).toBe(true);
		expect(asksForCurrentInformation("is there a new update")).toBe(true);
		expect(asksForCurrentInformation("which apk should I download")).toBe(false);
		expect(asksForCurrentInformation("how do I add a repository")).toBe(false);
	});

	it("finds an error quoted in the question", () => {
		const error = detectError("I got INSTALL_FAILED_NO_MATCHING_ABIS when installing", entries);
		expect(error).toBe("INSTALL_FAILED_NO_MATCHING_ABIS");
		expect(detectError("the app is fine, nothing is wrong", entries)).toBeNull();
	});
});

describe("retrieving the knowledge that answers a question", () => {
	it("finds the repository answer for a repository question", () => {
		expect(idsFor("how do I add a repository")).toContain("how-to-add-a-repository");
	});

	it("finds the APK answer for an APK question", () => {
		expect(idsFor("which apk should I download for my phone")).toContain("which-apk-to-download");
	});

	it("finds the empty-screen answer for a new install", () => {
		expect(idsFor("the app is empty after installing, where are the sources")).toContain("empty-home-after-install");
	});

	it("finds the Cloudflare answer for a Cloudflare question", () => {
		expect(idsFor("what is this cloudflare checking your browser page")).toContain("cloudflare-challenge");
	});

	it("finds the buffering answer for a buffering question", () => {
		expect(idsFor("why does playback keep buffering forever")).toContain("infinite-buffering");
	});

	it("finds the no-servers answer for a source that finds no links", () => {
		expect(idsFor("the source found the episode but there are no playable servers")).toContain(
			"source-no-playable-servers",
		);
	});

	it("finds the QR sign-in answer for a TV sign-in question", () => {
		expect(idsFor("how do I sign in to a TV using a QR code")).toContain("tv-qr-sign-in");
	});

	it("finds the subtitle answer for a missing-subtitles question", () => {
		expect(idsFor("how do I fix missing subtitles")).toContain("subtitles-and-sync");
	});

	it("finds the extension-update answer for an extension-update question", () => {
		expect(idsFor("how do I update extensions")).toContain("how-to-update-extensions");
	});

	it("finds the app-update answer for an app-update question", () => {
		expect(idsFor("how do I update the app")).toContain("updating-the-app");
	});

	it("finds the download answer for an offline question", () => {
		expect(idsFor("can I watch downloaded episodes offline")).toContain("downloads-and-offline");
	});

	it("finds the tracker answer for an AniList question", () => {
		expect(idsFor("how do I connect AniList")).toContain("anilist-and-trackers");
	});

	it("finds the bug-report answer for a bug-report question", () => {
		expect(idsFor("how do I report a bug")).toContain("bug-report-checklist");
	});

	it("finds the source-format answer for a difference-between-formats question", () => {
		const ids = idsFor("what is the difference between native Zangetsu sources and other extension formats");
		expect(ids).toContain("native-zangetsu-sources");
	});

	it("finds the app-versus-source answer for a whose-fault question", () => {
		expect(idsFor("is this a bug in zangetsu or is my source broken")).toContain("source-problem-or-app-problem");
	});

	it("matches an error string exactly, whatever the question is called", () => {
		const hits = retrieveKnowledge("my install failed with INSTALL_FAILED_NO_MATCHING_ABIS", { entries });
		const matched = hits.find((hit) => hit.matchedError !== null);

		expect(matched?.entry.id).toBe("install-failed-wrong-architecture");
	});

	it("returns nothing for a question about something else entirely", () => {
		expect(retrieveKnowledge("what is the capital of France", { entries })).toHaveLength(0);
	});

	it("puts the entry that matches on platform first when the platform is known", () => {
		const hits = retrieveKnowledge("how do I install it and does it work on android tv", { entries });
		const tvEntry = hits.find((hit) => hit.entry.platform === "android-tv");

		expect(tvEntry).toBeDefined();
	});

	it("never returns more than the limit", () => {
		expect(retrieveKnowledge("zangetsu app sources", { entries, limit: 2 })).toHaveLength(2);
	});

	it("scores a question it can answer above one it cannot", () => {
		const hits = retrieveKnowledge("how do I add a repository", { entries });
		const best = hits[0];
		const worst = hits.at(-1);

		expect(best?.score ?? 0).toBeGreaterThan(worst?.score ?? 0);
	});

	it("does not answer an empty question", () => {
		expect(retrieveKnowledge("   ", { entries })).toHaveLength(0);
	});

	it("works with a corpus of its own", () => {
		const custom: KnowledgeEntry[] = [
			{
				id: "only",
				title: "The only entry",
				topic: "install",
				platform: "any",
				versions: "",
				keywords: ["kite", "surfing"],
				questions: ["how do I fly a kite?"],
				errorStrings: [],
				sourceUrl: "https://example.com/guide",
				sourceType: "official",
				checkedAt: "2026-01-01",
				confidence: "high",
				outdated: false,
				body: "Take it to a field.",
			},
		];

		expect(retrieveKnowledge("how do I fly a kite?", { entries: custom }).map((hit) => hit.entry.id)).toEqual(["only"]);
		expect(retrieveKnowledge("something unrelated entirely", { entries: custom })).toHaveLength(0);
	});
});
