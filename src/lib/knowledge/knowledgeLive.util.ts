import { APP_RELEASES_URL, APP_REPOSITORY, KNOWLEDGE_LIMITS, OFFICIAL_GUIDE_URL } from "@lib/knowledge/knowledge.constants";
import { type KnowledgeEntry } from "@lib/knowledge/knowledge.types";
import { fetchGitHubReleases, type GitHubRelease, type GitHubRepository } from "@lib/releases";
import { observe } from "@lib/infra/serviceHealth.util";

/** What is true right now: the latest release, and the state of the official guide. */

export const ZANGETSU_APP_REPOSITORY: GitHubRepository = {
	owner: "spyou",
	repo: "zangetsu",
	fullName: APP_REPOSITORY.toLowerCase(),
	key: APP_REPOSITORY.toLowerCase(),
};

export interface LiveRelease {
	/** The tag as the maintainer wrote it, such as `v2.3.5`. */
	version: string;
	title: string;
	url: string;
	publishedAt: string;
	prerelease: boolean;
	/** The release notes, condensed to what a support answer needs. */
	notes: string;
}

export interface LiveSnapshot {
	release: LiveRelease | null;
	/** The last few releases, so a question about a particular version can be answered. */
	releases: LiveRelease[];
	/** When the official guide was last fetched, or null when it has never been reached. */
	guideCheckedAt: string | null;
	/** The guide's own section headings, which show what it covers right now. */
	guideSections: string[];
	/** True when the guide differs from the copy fetched on the previous successful check. */
	guideChanged: boolean;
	/** When this snapshot was taken. */
	checkedAt: string;
	/** True when the snapshot is older than its own freshness window. */
	stale: boolean;
	/** Why the snapshot could not be refreshed, when it could not. */
	failure: string | null;
}

const GUIDE_SERVICE = "Zangetsu official guide";
const RELEASE_SERVICE = "GitHub API";

let snapshot: LiveSnapshot = {
	release: null,
	releases: [],
	guideCheckedAt: null,
	guideSections: [],
	guideChanged: false,
	checkedAt: new Date(0).toISOString(),
	stale: true,
	failure: null,
};

let guideEtag: string | null = null;
let guideHash: string | null = null;
let refreshing: Promise<LiveSnapshot> | null = null;
let lastRefreshAt = 0;

/** The notes a support answer needs: the headline and the first few real lines. */
function condenseNotes(body: string | null): string {
	if (body === null) return "";
	const lines = body
		.replace(/\r\n/g, "\n")
		.split("\n")
		.map((line) => line.replace(/[*#`>]/g, "").trim())
		.filter((line) => line !== "" && !/^[-=|\s]+$/.test(line));

	const kept: string[] = [];
	for (const line of lines) {
		if (kept.length >= 6) break;
		if (kept.some((existing) => existing.toLowerCase() === line.toLowerCase())) continue;
		kept.push(line);
	}
	return kept.join("\n").slice(0, 1_200);
}

function toLiveRelease(release: GitHubRelease): LiveRelease {
	return {
		version: release.tag_name.trim(),
		title: release.name?.trim() || release.tag_name.trim(),
		url: release.html_url,
		publishedAt: release.published_at ?? "",
		prerelease: release.prerelease,
		notes: condenseNotes(release.body),
	};
}

async function fetchGuide(): Promise<{ checkedAt: string; sections: string[]; changed: boolean }> {
	const headers: Record<string, string> = {
		"User-Agent": "Zangetsu-Support-Assistant",
		Accept: "text/html",
	};
	if (guideEtag !== null) headers["If-None-Match"] = guideEtag;

	const response = await fetch(OFFICIAL_GUIDE_URL, { headers, signal: AbortSignal.timeout(10_000) });
	if (response.status === 304) {
		return { checkedAt: new Date().toISOString(), sections: snapshot.guideSections, changed: false };
	}
	if (!response.ok) throw new Error(`The official guide answered HTTP ${String(response.status)}.`);

	const html = await response.text();
	const etag = response.headers.get("etag");
	if (etag !== null) guideEtag = etag;

	const sections = [...html.matchAll(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi)]
		.map((match) => stripTags(match[1] ?? "").trim())
		.filter((heading) => heading !== "");

	let changed = false;
	const hash = hashOf(html);
	if (guideHash !== null && guideHash !== hash) changed = true;
	guideHash = hash;

	return { checkedAt: new Date().toISOString(), sections, changed };
}

function stripTags(value: string): string {
	return value
		.replace(/<[^>]+>/g, "")
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&nbsp;/g, " ");
}

function hashOf(value: string): string {
	let hash = 2_166_136_261;
	for (let index = 0; index < value.length; index += 1) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 16_777_619);
	}
	return (hash >>> 0).toString(16);
}

/** The snapshot the assistant reads. Never fetches anything, so a question is never held up by the network. */
export function liveSnapshot(): LiveSnapshot {
	const age = Date.now() - Date.parse(snapshot.checkedAt);
	return { ...snapshot, stale: !Number.isFinite(age) || age > KNOWLEDGE_LIMITS.snapshotTtlMs };
}

/** Fetches what changed, keeping the previous snapshot when a fetch fails. */
export async function refreshZangetsuLive(options: { force?: boolean; timeoutMs?: number } = {}): Promise<LiveSnapshot> {
	const now = Date.now();
	if (refreshing !== null) return refreshing;
	if (!options.force && now - lastRefreshAt < KNOWLEDGE_LIMITS.minRefreshGapMs) return liveSnapshot();

	const run = (async (): Promise<LiveSnapshot> => {
		let release: LiveRelease | null = snapshot.release;
		let releases = snapshot.releases;
		let guideCheckedAt = snapshot.guideCheckedAt;
		let guideSections = snapshot.guideSections;
		let guideChanged = false;
		const failures: string[] = [];

		try {
			const feeds = await observe(RELEASE_SERVICE, () => fetchGitHubReleases(ZANGETSU_APP_REPOSITORY));
			releases = feeds.slice(0, 8).map(toLiveRelease);
			release = releases.find((candidate) => !candidate.prerelease) ?? releases[0] ?? null;
		} catch (error) {
			failures.push(error instanceof Error ? error.message : "The release feed could not be reached.");
		}

		try {
			const guide = await observe(GUIDE_SERVICE, () => fetchGuide());
			guideCheckedAt = guide.checkedAt;
			guideSections = guide.sections;
			guideChanged = guide.changed;
		} catch (error) {
			failures.push(error instanceof Error ? error.message : "The official guide could not be reached.");
		}

		lastRefreshAt = Date.now();
		snapshot = {
			release,
			releases,
			guideCheckedAt,
			guideSections,
			guideChanged,
			checkedAt: new Date().toISOString(),
			stale: false,
			failure: failures.length === 0 ? null : failures.join(" "),
		};
		return liveSnapshot();
	})();

	refreshing = run;
	const release = (): void => {
		if (refreshing === run) refreshing = null;
	};
	run.then(release, release);

	if (options.timeoutMs === undefined) return run;

	// A member is waiting, so a slow lookup must not hold the answer up.
	return Promise.race([
		run,
		new Promise<LiveSnapshot>((resolve) => {
			setTimeout(() => resolve(liveSnapshot()), options.timeoutMs).unref?.();
		}),
	]);
}

/** The version the app is on now, read without touching the network. */
export function currentVersion(): string | null {
	return snapshot.release?.version ?? null;
}

/** The release notes for a version somebody named, when the feed still holds it. */
export function releaseFor(version: string): LiveRelease | null {
	const wanted = version.trim().toLowerCase();
	return snapshot.releases.find((release) => release.version.toLowerCase() === wanted) ?? null;
}

/** Used by the tests so each one can start from a known snapshot. */
export function setLiveSnapshot(next: LiveSnapshot): void {
	snapshot = next;
}

export function resetLiveSnapshot(): void {
	snapshot = {
		release: null,
		releases: [],
		guideCheckedAt: null,
		guideSections: [],
		guideChanged: false,
		checkedAt: new Date(0).toISOString(),
		stale: true,
		failure: null,
	};
	guideEtag = null;
	guideHash = null;
	lastRefreshAt = 0;
}

/** Whether an entry's source has moved on since it was written. */
export function entryLooksStale(entry: KnowledgeEntry, live: LiveSnapshot): boolean {
	if (entry.outdated) return true;
	if (entry.sourceType !== "official") return false;
	if (entry.sourceUrl.startsWith(OFFICIAL_GUIDE_URL)) return live.guideChanged;
	return false;
}

export const ZANGETSU_LINKS = {
	releases: APP_RELEASES_URL,
	guide: OFFICIAL_GUIDE_URL,
} as const;
