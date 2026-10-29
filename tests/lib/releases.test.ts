import {
	fetchGitHubReleases,
	parseGitHubRepository,
	releasesAfterCursor,
	resetGitHubReleaseCache,
	type GitHubRelease,
} from "@lib/releases";

const repository = parseGitHubRepository("MewtwoOP1/Zangetsu");
const originalFetch = globalThis.fetch;

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
});

afterEach(() => {
	globalThis.fetch = originalFetch;
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
		expect(parseGitHubRepository("https://user:pass@github.com/owner/repo")).toBeNull();
		expect(parseGitHubRepository("https://github.com/owner/repo/releases")).toBeNull();
		expect(parseGitHubRepository("owner/repo/issues")).toBeNull();
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

		const result = await fetchGitHubReleases(repository!);

		expect(result).toEqual([release()]);
		expect(fetchMock).toHaveBeenCalledWith(
			"https://api.github.com/repos/mewtwoop1/zangetsu/releases?per_page=20",
			expect.objectContaining({
				headers: expect.not.objectContaining({ Authorization: expect.anything() }),
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

		const first = await fetchGitHubReleases(repository!);
		const second = await fetchGitHubReleases(repository!);

		expect(second).toEqual(first);
		expect(fetchMock.mock.calls[1]?.[1]).toEqual(
			expect.objectContaining({
				headers: expect.objectContaining({ "If-None-Match": '"release-etag"' }),
			}),
		);
	});

	it("returns a useful error for public repositories that cannot be fetched", async () => {
		const fetchMock = jest.fn();
		globalThis.fetch = fetchMock as typeof fetch;
		fetchMock.mockResolvedValueOnce(new Response("{}", { status: 404 }));

		await expect(fetchGitHubReleases(repository!, { forceRefresh: true })).rejects.toThrow(
			"Private repositories need a GitHub token",
		);
	});

	it("surfaces network, rate-limit, server, and malformed-response errors", async () => {
		const fetchMock = jest.fn();
		globalThis.fetch = fetchMock as typeof fetch;

		fetchMock.mockRejectedValueOnce(new Error("offline"));
		await expect(fetchGitHubReleases(repository!, { forceRefresh: true })).rejects.toThrow("Could not contact GitHub");

		fetchMock.mockResolvedValueOnce(new Response("{}", { status: 403 }));
		await expect(fetchGitHubReleases(repository!, { forceRefresh: true })).rejects.toThrow("rate limit");

		fetchMock.mockResolvedValueOnce(new Response("{}", { status: 429 }));
		await expect(fetchGitHubReleases(repository!, { forceRefresh: true })).rejects.toThrow("rate limit");

		fetchMock.mockResolvedValueOnce(new Response("{}", { status: 500 }));
		await expect(fetchGitHubReleases(repository!, { forceRefresh: true })).rejects.toThrow("HTTP 500");

		fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ message: "not an array" }), { status: 200 }));
		await expect(fetchGitHubReleases(repository!, { forceRefresh: true })).rejects.toThrow(
			"unexpected releases response",
		);

		fetchMock.mockResolvedValueOnce(new Response(JSON.stringify([null]), { status: 200 }));
		await expect(fetchGitHubReleases(repository!, { forceRefresh: true })).rejects.toThrow("malformed release entry");
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
