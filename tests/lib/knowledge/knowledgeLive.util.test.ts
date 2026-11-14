import { liveSnapshot, refreshZangetsuLive, releaseFor, resetLiveSnapshot } from "@lib/knowledge/knowledgeLive.util";

describe("the live Zangetsu facts", () => {
	beforeEach(() => {
		resetLiveSnapshot();
		jest.restoreAllMocks();
	});

	it("reads the newest release and the notes that go with it", async () => {
		jest.spyOn(global, "fetch").mockImplementation(async (input) => {
			const url = String(input);
			if (url.includes("api.github.com")) {
				return new Response(
					JSON.stringify([
						{
							id: 2,
							tag_name: "v2.4.0",
							name: "Zangetsu v2.4.0",
							html_url: "https://github.com/Spyou/Zangetsu/releases/tag/v2.4.0",
							body: "## Fixed\n- Android TV subtitles",
							published_at: "2026-11-01T00:00:00Z",
							draft: false,
							prerelease: false,
						},
						{
							id: 1,
							tag_name: "v2.3.9",
							name: "Zangetsu v2.3.9",
							html_url: "https://github.com/Spyou/Zangetsu/releases/tag/v2.3.9",
							body: "Old",
							published_at: "2026-10-01T00:00:00Z",
							draft: false,
							prerelease: false,
						},
					]),
					{ status: 200, headers: { "content-type": "application/json" } },
				);
			}
			return new Response("<html><h2>Getting started</h2><h3>Which file</h3></html>", {
				status: 200,
				headers: { "content-type": "text/html", etag: '"abc"' },
			});
		});

		const snapshot = await refreshZangetsuLive({ force: true });

		expect(snapshot.release?.version).toBe("v2.4.0");
		expect(snapshot.release?.notes).toContain("Android TV subtitles");
		expect(snapshot.guideSections).toContain("Getting started");
		expect(snapshot.failure).toBeNull();
		expect(snapshot.stale).toBe(false);
	});

	it("keeps the last good copy when the network fails", async () => {
		jest.spyOn(global, "fetch").mockRejectedValue(new Error("network is down"));

		const snapshot = await refreshZangetsuLive({ force: true });

		expect(snapshot.failure).not.toBeNull();
		expect(snapshot.release).toBeNull();
	});

	it("does not fetch the same thing twice inside the refresh window", async () => {
		const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
			new Response(JSON.stringify([]), { status: 200, headers: { "content-type": "application/json" } }),
		);

		await refreshZangetsuLive({ force: true });
		const after = fetchMock.mock.calls.length;
		await refreshZangetsuLive();

		expect(fetchMock.mock.calls.length).toBe(after);
	});

	it("reports that the guide changed when the page differs", async () => {
		const guide = (body: string): Response =>
			new Response(`<html><h2>${body}</h2></html>`, { status: 200, headers: { "content-type": "text/html" } });

		jest.spyOn(global, "fetch").mockImplementation(async (input) =>
			String(input).includes("api.github.com")
				? new Response(JSON.stringify([]), { status: 200, headers: { "content-type": "application/json" } })
				: guide("First"),
		);

		await refreshZangetsuLive({ force: true });
		expect(liveSnapshot().guideChanged).toBe(false);

		jest.spyOn(global, "fetch").mockImplementation(async (input) =>
			String(input).includes("api.github.com")
				? new Response(JSON.stringify([]), { status: 200, headers: { "content-type": "application/json" } })
				: guide("Second"),
		);

		await refreshZangetsuLive({ force: true });
		expect(liveSnapshot().guideChanged).toBe(true);
		expect(liveSnapshot().guideSections).toContain("Second");
	});

	it("finds the release of a version somebody named", async () => {
		jest.spyOn(global, "fetch").mockImplementation(async (input) =>
			String(input).includes("api.github.com")
				? new Response(
						JSON.stringify([
							{
								id: 3,
								tag_name: "v2.3.5",
								name: "Zangetsu v2.3.5",
								html_url: "https://github.com/Spyou/Zangetsu/releases/tag/v2.3.5",
								body: "Notes",
								published_at: "2026-09-01T00:00:00Z",
								draft: false,
								prerelease: false,
							},
						]),
						{ status: 200, headers: { "content-type": "application/json" } },
					)
				: new Response("<html></html>", { status: 200, headers: { "content-type": "text/html" } }),
		);

		await refreshZangetsuLive({ force: true });

		expect(releaseFor("v2.3.5")?.version).toBe("v2.3.5");
		expect(releaseFor("v1.0.0")).toBeNull();
	});
});
