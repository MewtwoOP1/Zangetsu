const RELEASE_PAGE_SIZE = 100;
const GITHUB_API = "https://api.github.com";

export interface GitHubRepository {
	owner: string;
	repo: string;
	fullName: string;
	key: string;
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
		typeof release.prerelease === "boolean"
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
