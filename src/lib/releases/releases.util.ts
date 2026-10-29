const RELEASE_PAGE_SIZE = 100;
const GITHUB_API = "https://api.github.com";

export interface GitHubRepository {
	owner: string;
	repo: string;
	fullName: string;
	key: string;
}

export interface GitHubReleaseAsset {
	name: string;
	browser_download_url: string;
}

export interface GitHubRelease {
	id: number;
	tag_name: string;
	name: string | null;
	html_url: string;
	body: string | null;
	published_at: string | null;
	draft: boolean;
	prerelease: boolean;
	assets?: GitHubReleaseAsset[];
}

interface CachedReleaseFeed {
	etag: string | null;
	releases: GitHubRelease[];
}

const releaseCache = new Map<string, CachedReleaseFeed>();

export function parseGitHubRepository(input: string): GitHubRepository | null {
	const value = input.trim();
	if (value === "") return null;

	let path = value;
	if (/^https?:\/\//i.test(value)) {
		try {
			const url = new URL(value);
			if (url.hostname.toLowerCase() !== "github.com" || url.username !== "" || url.password !== "") return null;
			const parts = url.pathname.split("/").filter(Boolean);
			if (parts.length !== 2) return null;
			path = parts.join("/");
		} catch {
			return null;
		}
	} else if (/^github\.com\//i.test(value)) {
		path = value.slice("github.com/".length);
	}

	path = path.replace(/\/+$/, "").replace(/\.git$/i, "");
	const parts = path.split("/");
	if (parts.length !== 2) return null;

	const [rawOwner, rawRepo] = parts;
	if (rawOwner === undefined || rawRepo === undefined) return null;
	if (!/^[a-z\d](?:[a-z\d-]{0,38})$/i.test(rawOwner)) return null;
	if (!/^[a-z\d._-]{1,100}$/i.test(rawRepo) || rawRepo === "." || rawRepo === "..") return null;

	const owner = rawOwner.toLowerCase();
	const repo = rawRepo.toLowerCase();
	return { owner, repo, fullName: `${owner}/${repo}`, key: `${owner}/${repo}` };
}

export async function fetchGitHubReleases(
	repository: GitHubRepository,
	options: { forceRefresh?: boolean } = {},
): Promise<GitHubRelease[]> {
	const cached = releaseCache.get(repository.key);
	const headers: Record<string, string> = {
		Accept: "application/vnd.github+json",
		"User-Agent": "Zangetsu-Release-Announcements",
		"X-GitHub-Api-Version": "2022-11-28",
	};
	const githubToken = process.env.GITHUB_TOKEN?.trim();
	if (githubToken) headers.Authorization = `Bearer ${githubToken}`;
	if (!options.forceRefresh && cached?.etag) headers["If-None-Match"] = cached.etag;

	let response: Response;
	try {
		const repositoryPath = `/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.repo)}`;
		const endpoint = `${GITHUB_API}${repositoryPath}/releases`;
		response = await fetch(`${endpoint}?per_page=${String(RELEASE_PAGE_SIZE)}`, {
			headers,
			signal: AbortSignal.timeout(10_000),
		});
	} catch (error) {
		const detail = error instanceof Error ? error.message : "network request failed";
		throw new Error(`Could not contact GitHub: ${detail}`);
	}

	if (response.status === 304 && cached) return cached.releases;
	if (response.status === 404) {
		throw new Error("GitHub could not find this public repository. Private repositories are not supported by this feature.");
	}
	if (response.status === 401) {
		throw new Error(
			githubToken
				? "GitHub rejected GITHUB_TOKEN. Check that the token is valid, not expired, and has public repository read access."
				: "GitHub returned HTTP 401 for a public API request.",
		);
	}
	if (response.status === 403 || response.status === 429) {
		const payload: unknown = await response.clone().json().catch(() => null);
		const apiMessage =
			typeof payload === "object" && payload !== null && "message" in payload && typeof payload.message === "string"
				? payload.message
				: null;
		const remaining = response.headers.get("x-ratelimit-remaining");
		const reset = Number(response.headers.get("x-ratelimit-reset"));
		const retryAfter = response.headers.get("retry-after");
		const rateLimited =
			response.status === 429 || remaining === "0" || (apiMessage !== null && /rate limit|abuse detection/i.test(apiMessage));
		if (rateLimited) {
			const retryHint = Number.isFinite(reset) && reset > 0
				? ` Try again after ${new Date(reset * 1_000).toISOString()} (UTC).`
				: retryAfter !== null
					? ` Retry after ${retryAfter} seconds.`
					: "";
			throw new Error(`GitHub API rate limit reached${apiMessage ? `: ${apiMessage}` : "."}${retryHint}`);
		}
		throw new Error(`GitHub denied the request (HTTP ${String(response.status)})${apiMessage ? `: ${apiMessage}` : "."}`);
	}
	if (!response.ok) throw new Error(`GitHub returned HTTP ${String(response.status)}.`);

	const payload: unknown = await response.json();
	if (!Array.isArray(payload)) throw new Error("GitHub returned an unexpected releases response.");

	const releases: GitHubRelease[] = [];
	for (const value of payload as unknown[]) {
		if (!isRelease(value)) throw new Error("GitHub returned a malformed release entry.");
		if (value.draft || value.published_at === null) continue;
		releases.push(value);
	}

	const feed = { etag: response.headers.get("etag"), releases };
	releaseCache.set(repository.key, feed);
	return releases;
}

function isRelease(value: unknown): value is GitHubRelease {
	if (typeof value !== "object" || value === null) return false;
	const release = value as Record<string, unknown>;
	return (
		typeof release.id === "number" &&
		typeof release.tag_name === "string" &&
		(release.name === null || typeof release.name === "string") &&
		typeof release.html_url === "string" &&
		(release.body === null || typeof release.body === "string") &&
		(release.published_at === null || typeof release.published_at === "string") &&
		typeof release.draft === "boolean" &&
		typeof release.prerelease === "boolean" &&
		(release.assets === undefined ||
			(Array.isArray(release.assets) &&
				release.assets.every((asset) => {
					if (typeof asset !== "object" || asset === null) return false;
					const candidate = asset as Record<string, unknown>;
					return typeof candidate.name === "string" && typeof candidate.browser_download_url === "string";
				})))
	);
}

export function releasesAfterCursor(
	releases: GitHubRelease[],
	lastReleaseId: number | null,
	lastReleasePublishedAt: string | null,
): GitHubRelease[] {
	const published = releases.filter((release) => !release.draft && release.published_at !== null);
	const chronological = (left: GitHubRelease, right: GitHubRelease): number => {
		const timeDifference = Date.parse(left.published_at ?? "") - Date.parse(right.published_at ?? "");
		return timeDifference === 0 || Number.isNaN(timeDifference) ? left.id - right.id : timeDifference;
	};

	if (lastReleaseId === null) return [...published].sort(chronological);

	const cursorTime = lastReleasePublishedAt === null ? Number.NaN : Date.parse(lastReleasePublishedAt);
	if (Number.isFinite(cursorTime)) {
		return published
			.filter((release) => {
				const releaseTime = Date.parse(release.published_at ?? "");
				return releaseTime > cursorTime || (releaseTime === cursorTime && release.id > lastReleaseId);
			})
			.sort(chronological);
	}

	const cursorIndex = published.findIndex((release) => release.id === lastReleaseId);
	return cursorIndex >= 0 ? published.slice(0, cursorIndex).sort(chronological) : [];
}

export function resetGitHubReleaseCache(): void {
	releaseCache.clear();
}

/** Builds the plain-text Discord announcement used for both previews and published releases. */
export function formatGitHubReleaseAnnouncement(repository: GitHubRepository, release: GitHubRelease): string {
	const isZangetsuApp = repository.owner.toLowerCase() === "spyou" && repository.repo.toLowerCase() === "zangetsu";
	const version = release.tag_name.trim();
	const title = isZangetsuApp
		? `<:new_icon:1548743773930922075> Zangetsu ${version}`
		: `${repository.fullName} · ${release.name?.trim() || version}`;
	const releaseType = release.prerelease ? "Pre-release" : "Stable Release";
	const publishedDate = release.published_at
		? new Date(release.published_at).toLocaleDateString("en-GB", {
				day: "2-digit",
				month: "long",
				year: "numeric",
				timeZone: "UTC",
			})
		: "Date unavailable";

	const parsedNotes = parseReleaseNotes(release.body ?? "");
	const sectionNames = parsedNotes.sections.map((section) => section.title).filter(Boolean);
	const summary = parsedNotes.summary || (sectionNames.length > 0
		? `A smoother experience with updates to ${formatNaturalList(sectionNames)}.`
		: "A new release with the latest features and improvements.");
	const highlights = parsedNotes.sections.map((section) => {
		const bullets = section.bullets.join("; ");
		return bullets ? `- **${section.title}:** ${bullets}` : "";
	}).filter(Boolean).join("\n") || "- Release notes are available on the GitHub release page.";
	const downloadLinks = formatReleaseDownloads(release, isZangetsuApp);
	const footer = isZangetsuApp
		? "-# Z A N G E T S U  •  O F F I C I A L  R E L E A S E"
		: `-# ${repository.fullName.toUpperCase()} · OFFICIAL RELEASE`;

	// Keep a comfortable margin below Discord's 2,000-character message limit, including a possible role ping.
	const maxHighlightsLength = 1_000;
	const shortenedHighlights = highlights.length > maxHighlightsLength
		? `${highlights.slice(0, maxHighlightsLength - 1).trimEnd()}…`
		: highlights;
	const message = [
		title,
		`-# ${releaseType} · ${publishedDate}`,
		"",
		truncateText(summary, 260),
		"",
		"**What's New**",
		shortenedHighlights,
		"",
		"**Downloads**",
		downloadLinks,
		"",
		footer,
	].join("\n");

	return message.length > 1_850 ? `${message.slice(0, 1_849).trimEnd()}…` : message;
}

interface ParsedReleaseNoteSection {
	title: string;
	bullets: string[];
}

function parseReleaseNotes(body: string): { summary: string; sections: ParsedReleaseNoteSection[] } {
	const sections: ParsedReleaseNoteSection[] = [];
	const introLines: string[] = [];
	let currentSection: ParsedReleaseNoteSection | null = null;
	let skipSection = false;

	for (const rawLine of body.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line) continue;

		const heading = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
		if (heading) {
			const title = heading[2]?.trim() ?? "";
			skipSection = /^(downloads?|assets|checksums?)$/i.test(title);
			if (skipSection) {
				currentSection = null;
				continue;
			}
			currentSection = { title, bullets: [] };
			sections.push(currentSection);
			continue;
		}
		if (skipSection || /^\|?\s*:?-{3,}/.test(line) || /^\|?\s*file\s*\|/i.test(line) || /^\|?\s*---/.test(line)) continue;

		const bullet = /^(?:[-*+]\s+|\d+[.)]\s+)(.+)$/.exec(line);
		if (bullet) {
			const text = bullet[1]?.trim();
			if (text) {
				if (!currentSection) {
					currentSection = { title: "Highlights", bullets: [] };
					sections.push(currentSection);
				}
				currentSection.bullets.push(text);
			}
			continue;
		}

		if (/^\|/.test(line)) continue;
		if (currentSection && currentSection.bullets.length > 0) {
			const lastIndex = currentSection.bullets.length - 1;
			currentSection.bullets[lastIndex] = `${currentSection.bullets[lastIndex]} ${line}`;
		} else {
			introLines.push(line);
		}
	}

	const summary = introLines.join(" ").replace(/\s+/g, " ").trim();
	if (sections.length === 0 && summary) sections.push({ title: "Highlights", bullets: [summary] });
	return { summary, sections };
}

function formatNaturalList(values: string[]): string {
	if (values.length <= 1) return values[0] ?? "the app";
	if (values.length === 2) return `${values[0]} and ${values[1]}`;
	return `${values.slice(0, -1).join(", ")}, and ${values[values.length - 1]}`;
}

function formatReleaseDownloads(release: GitHubRelease, isZangetsuApp: boolean): string {
	const assets = (release.assets ?? []).filter((asset) => /^https?:\/\//i.test(asset.browser_download_url));
	if (isZangetsuApp) {
		const preferred: Array<{ label: string; pattern: RegExp }> = [
			{ label: "ARM64", pattern: /arm64-v8a.*\.apk$/i },
			{ label: "ARMv7", pattern: /armeabi-v7a.*\.apk$/i },
			{ label: "Universal", pattern: /universal.*\.apk$/i },
			{ label: "Android TV", pattern: /(?:^|[-_])tv.*\.apk$/i },
		];
		const links = preferred.flatMap(({ label, pattern }) => {
			const asset = assets.find((candidate) => pattern.test(candidate.name));
			return asset ? [`[${label}](${asset.browser_download_url})`] : [];
		});
		return links.length > 0 ? links.join(" · ") : "No APK downloads are attached to this release yet.";
	}

	const links = assets.slice(0, 5).map((asset) => `[${asset.name}](${asset.browser_download_url})`);
	return links.length > 0 ? links.join(" · ") : `[View release assets](${release.html_url})`;
}

function truncateText(value: string, maxLength: number): string {
	if (value.length <= maxLength) return value;
	const trimmed = value.slice(0, maxLength - 1).trimEnd();
	return `${trimmed}…`;
}
