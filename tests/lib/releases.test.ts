import {
	fetchGitHubReleases,
	formatGitHubReleaseAnnouncement,
	parseGitHubRepository,
	releasesAfterCursor,
	resetGitHubReleaseCache,
	type GitHubRelease,
	type GitHubRepository,
} from "@lib/releases";

const repository: GitHubRepository = {
	owner: "mewtwoop1",
	repo: "zangetsu",
	fullName: "mewtwoop1/zangetsu",
	key: "mewtwoop1/zangetsu",
};
const originalFetch = globalThis.fetch;
const originalGitHubToken = process.env.GITHUB_TOKEN;

function release(overrides: Partial<GitHubRelease> = {}): GitHubRelease {
	return {
		id: 10,
		tag_name: "v1.0.0",
		name: "Release v1.0.0",
		html_url: "https://github.com/mewtwoop1/zangetsu/releases/tag/v1.0.0",
		body: "Bug fixes",
		published_at: "2026-10-29T10:00:00Z",
		draft: false,
		prerelease: false,
		...overrides,
	};
}

beforeEach(() => {
	resetGitHubReleaseCache();
	delete process.env.GITHUB_TOKEN;
});

afterEach(() => {
	globalThis.fetch = originalFetch;
	if (originalGitHubToken === undefined) delete process.env.GITHUB_TOKEN;
	else process.env.GITHUB_TOKEN = originalGitHubToken;
	jest.restoreAllMocks();
});

describe("parseGitHubRepository", () => {
	it("accepts repository names and public GitHub repository URLs", () => {
		expect(parseGitHubRepository("MewtwoOP1/Zangetsu")).toEqual(repository);
		expect(parseGitHubRepository("https://github.com/MewtwoOP1/Zangetsu")).toEqual(repository);
		expect(parseGitHubRepository("github.com/MewtwoOP1/Zangetsu.git")).toEqual(repository);
	});

	it("rejects URLs that do not identify a public GitHub repository root", () => {
		expect(parseGitHubRepository("https://example.com/owner/repo")).toBeNull();
		expect(parseGitHubRepository("https://[invalid/owner/repo")).toBeNull();
		expect(parseGitHubRepository("https://user:pass@github.com/owner/repo")).toBeNull();
		expect(parseGitHubRepository("https://github.com/owner/repo/releases")).toBeNull();
		expect(parseGitHubRepository("owner/repo/issues")).toBeNull();
		expect(parseGitHubRepository("bad_owner/repo")).toBeNull();
		expect(parseGitHubRepository("owner/repo!")).toBeNull();
		expect(parseGitHubRepository("owner/..")).toBeNull();
		expect(parseGitHubRepository("")).toBeNull();
	});
});

describe("fetchGitHubReleases", () => {
	it("uses the unauthenticated public API and ignores drafts", async () => {
		const fetchMock = jest.fn();
		globalThis.fetch = fetchMock as typeof fetch;
		fetchMock.mockResolvedValueOnce(
			new Response(
				JSON.stringify([
					release(),
					release({ id: 11, tag_name: "draft", draft: true, published_at: null }),
				]),
				{ status: 200, headers: { etag: '"release-etag"' } },
			),
		);

		const result = await fetchGitHubReleases(repository);

		expect(result).toEqual([release()]);
		expect(fetchMock).toHaveBeenCalledWith(
			"https://api.github.com/repos/mewtwoop1/zangetsu/releases?per_page=100",
			expect.objectContaining({
				headers: expect.not.objectContaining({ Authorization: expect.anything() }),
			}),
		);
	});

	it("uses GITHUB_TOKEN when configured", async () => {
		const fetchMock = jest.fn();
		globalThis.fetch = fetchMock as typeof fetch;
		process.env.GITHUB_TOKEN = "github_pat_example";
		fetchMock.mockResolvedValueOnce(new Response(JSON.stringify([release()]), { status: 200 }));

		await fetchGitHubReleases(repository);

		expect(fetchMock).toHaveBeenCalledWith(
			"https://api.github.com/repos/mewtwoop1/zangetsu/releases?per_page=100",
			expect.objectContaining({
				headers: expect.objectContaining({ Authorization: "Bearer github_pat_example" }),
			}),
		);
	});

	it("reuses the cached feed when GitHub replies 304, so failed Discord sends can be retried", async () => {
		const fetchMock = jest.fn();
		globalThis.fetch = fetchMock as typeof fetch;
		fetchMock
			.mockResolvedValueOnce(
				new Response(JSON.stringify([release()]), {
					status: 200,
					headers: { etag: '"release-etag"' },
				}),
			)
			.mockResolvedValueOnce(new Response(null, { status: 304 }));

		const first = await fetchGitHubReleases(repository);
		const second = await fetchGitHubReleases(repository);

		expect(second).toEqual(first);
		expect(fetchMock.mock.calls[1]?.[1]).toEqual(
			expect.objectContaining({
				headers: expect.objectContaining({ "If-None-Match": '"release-etag"' }),
			}),
		);
	});

	it("returns a clear message when the repository is private or unavailable", async () => {
		const fetchMock = jest.fn();
		globalThis.fetch = fetchMock as typeof fetch;
		fetchMock.mockResolvedValueOnce(new Response("{}", { status: 404 }));

		await expect(fetchGitHubReleases(repository, { forceRefresh: true })).rejects.toThrow(
			"Private repositories are not supported by this keyless feature",
		);
	});

	it("surfaces network, rate-limit, server, and malformed-response errors", async () => {
		const fetchMock = jest.fn();
		globalThis.fetch = fetchMock as typeof fetch;

		fetchMock.mockRejectedValueOnce(new Error("offline"));
		await expect(fetchGitHubReleases(repository, { forceRefresh: true })).rejects.toThrow("Could not contact GitHub");

		fetchMock.mockResolvedValueOnce(
			new Response(JSON.stringify({ message: "API rate limit exceeded" }), {
				status: 403,
				headers: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1793210000" },
			}),
		);
		await expect(fetchGitHubReleases(repository, { forceRefresh: true })).rejects.toThrow("rate limit");

		fetchMock.mockResolvedValueOnce(new Response("{}", { status: 429 }));
		await expect(fetchGitHubReleases(repository, { forceRefresh: true })).rejects.toThrow("rate limit");

		fetchMock.mockResolvedValueOnce(new Response("{}", { status: 500 }));
		await expect(fetchGitHubReleases(repository, { forceRefresh: true })).rejects.toThrow("HTTP 500");

		fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ message: "not an array" }), { status: 200 }));
		await expect(fetchGitHubReleases(repository, { forceRefresh: true })).rejects.toThrow(
			"unexpected releases response",
		);

		fetchMock.mockResolvedValueOnce(new Response(JSON.stringify([null]), { status: 200 }));
		await expect(fetchGitHubReleases(repository, { forceRefresh: true })).rejects.toThrow("malformed release entry");
	});
});

describe("formatGitHubReleaseAnnouncement", () => {
	it("formats the latest Zangetsu app release as a plain-text message with release assets", () => {
		const appRepository: GitHubRepository = {
			owner: "spyou",
			repo: "zangetsu",
			fullName: "spyou/zangetsu",
			key: "spyou/zangetsu",
		};
		const message = formatGitHubReleaseAnnouncement(
			appRepository,
			release({
				tag_name: "v2.3.3",
				name: "Zangetsu v2.3.3",
				published_at: "2026-10-22T15:17:00Z",
				body: "### Home & browsing\\n\\n- Browse sources directly from Home.\\n- Search within the selected catalogue.\\n\\n### Downloads\\n\\nFile | For\\n--- | ---\\nOld APK | Phone",
				assets: [
					{
						name: "Zangetsu-v2.3.3-arm64-v8a.apk",
						browser_download_url: "https://github.com/Spyou/Zangetsu/releases/download/v2.3.3/Zangetsu-v2.3.3-arm64-v8a.apk",
					},
					{
						name: "Zangetsu-v2.3.3-armeabi-v7a.apk",
						browser_download_url: "https://github.com/Spyou/Zangetsu/releases/download/v2.3.3/Zangetsu-v2.3.3-armeabi-v7a.apk",
					},
					{
						name: "Zangetsu-v2.3.3-universal.apk",
						browser_download_url: "https://github.com/Spyou/Zangetsu/releases/download/v2.3.3/Zangetsu-v2.3.3-universal.apk",
					},
					{
						name: "Zangetsu-v2.3.3-tv.apk",
						browser_download_url: "https://github.com/Spyou/Zangetsu/releases/download/v2.3.3/Zangetsu-v2.3.3-tv.apk",
					},
				],
			}),
		);

		expect(message).toContain("<:new_icon:1548743773930922075> Zangetsu v2.3.3");
		expect(message).toContain("-# Stable Release · 22 October 2026");
		expect(message).toContain("**What's New**");
		expect(message).toContain("- **Home & browsing:** Browse sources directly from Home.; Search within the selected catalogue.");
		expect(message).toContain("[ARM64](https://github.com/Spyou/Zangetsu/releases/download/v2.3.3/Zangetsu-v2.3.3-arm64-v8a.apk)");
		expect(message).toContain("[Android TV](https://github.com/Spyou/Zangetsu/releases/download/v2.3.3/Zangetsu-v2.3.3-tv.apk)");
		expect(message).toContain("-# Z A N G E T S U  •  O F F I C I A L  R E L E A S E");
		expect(message.length).toBeLessThanOrEqual(1_850);
	});
});

describe("releasesAfterCursor", () => {
	it("returns only releases newer than the saved cursor in chronological order", () => {
		const newest = release({ id: 13, tag_name: "v1.3.0", published_at: "2026-10-29T13:00:00Z" });
		const previous = release({ id: 12, tag_name: "v1.2.0", published_at: "2026-10-29T12:00:00Z" });
		const cursor = release({ id: 11, tag_name: "v1.1.0", published_at: "2026-10-29T11:00:00Z" });

		expect(releasesAfterCursor([newest, previous, cursor], 11, cursor.published_at)).toEqual([previous, newest]);
	});

	it("announces all releases created after a repository was added without a previous release", () => {
		const oldest = release({ id: 20, published_at: "2026-10-29T10:00:00Z" });
		const newest = release({ id: 21, published_at: "2026-10-29T11:00:00Z" });

		expect(releasesAfterCursor([newest, oldest], null, null)).toEqual([oldest, newest]);
	});

	it("uses publication time when a newer release was created before the saved release", () => {
		const cursor = release({ id: 40, published_at: "2026-10-29T12:00:00Z" });
		const publishedLater = release({
			id: 41,
			tag_name: "v1.1.0",
			published_at: "2026-10-29T13:00:00Z",
		});

		expect(releasesAfterCursor([cursor, publishedLater], cursor.id, cursor.published_at)).toEqual([publishedLater]);
	});

	it("does not replay old releases when a saved cursor has aged out of the recent feed", () => {
		const older = release({ id: 31, published_at: "2026-10-28T10:00:00Z" });
		const newer = release({ id: 32, published_at: "2026-10-30T10:00:00Z" });

		expect(releasesAfterCursor([newer, older], 30, "2026-10-29T10:00:00Z")).toEqual([newer]);
	});

	it("filters drafts and unpublished releases from candidate announcements", () => {
		const draft = release({ id: 50, draft: true });
		const unpublished = release({ id: 51, published_at: null });
		const published = release({ id: 52 });

		expect(releasesAfterCursor([draft, unpublished, published], null, null)).toEqual([published]);
	});

	it("uses the release ID as a fallback when the saved publication time is absent", () => {
		const cursor = release({ id: 60 });
		const newer = release({ id: 61, published_at: "2026-10-30T10:00:00Z" });

		expect(releasesAfterCursor([newer, cursor], cursor.id, null)).toEqual([newer]);
		expect(releasesAfterCursor([newer], 999, null)).toEqual([]);
	});
});
