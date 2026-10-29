import { type ReleaseAnnouncementSettings } from "@database/models/releaseAnnouncements.schema";
import {
	listReleaseAnnouncementSettings,
	updateTrackedGitHubRelease,
} from "@database/repositories/releaseAnnouncementRepository";
import { fetchGitHubReleases, type GitHubRelease } from "@lib/releases";
import { checkGitHubReleaseAnnouncements } from "@jobs/githubReleaseAnnouncements.util";
import { createMockChannel, createMockClient, GUILD_ID, CHANNEL_ID, ROLE_ID } from "@tests/helpers/mocks";

jest.mock("@database/repositories/releaseAnnouncementRepository", () => ({
	listReleaseAnnouncementSettings: jest.fn(),
	updateTrackedGitHubRelease: jest.fn(),
}));

jest.mock("@lib/releases", () => ({
	...jest.requireActual("@lib/releases"),
	fetchGitHubReleases: jest.fn(),
}));

jest.mock("@lib/discord", () => ({
	embed: jest.fn((options: unknown) => options),
}));

const settings: ReleaseAnnouncementSettings = {
	guildId: GUILD_ID,
	channelId: CHANNEL_ID,
	roleId: ROLE_ID,
	repositories: [
		{
			owner: "mewtwoop1",
			repo: "zangetsu",
			lastReleaseId: 1,
			lastReleasePublishedAt: "2026-10-01T00:00:00.000Z",
		},
	],
	createdAt: new Date("2026-10-01T00:00:00.000Z"),
	updatedAt: new Date("2026-10-01T00:00:00.000Z"),
};

const publishedRelease: GitHubRelease = {
	id: 2,
	tag_name: "v2.0.7",
	name: "Zangetsu v2.0.7",
	html_url: "https://github.com/MewtwoOP1/Zangetsu/releases/tag/v2.0.7",
	body: "Fixes and improvements",
	published_at: "2026-10-29T10:00:00.000Z",
	draft: false,
	prerelease: false,
};

function clientWithChannel(channel: ReturnType<typeof createMockChannel>) {
	return createMockClient({
		channels: { fetch: jest.fn(() => Promise.resolve(channel)) },
	} as never);
}

beforeEach(() => {
	jest.clearAllMocks();
	jest.mocked(listReleaseAnnouncementSettings).mockResolvedValue([settings]);
	jest.mocked(fetchGitHubReleases).mockResolvedValue([publishedRelease]);
	jest.mocked(updateTrackedGitHubRelease).mockResolvedValue();
});

describe("checkGitHubReleaseAnnouncements", () => {
	it("posts a role-limited embed and records the release cursor only after delivery", async () => {
		const channel = createMockChannel();
		const client = clientWithChannel(channel);

		await checkGitHubReleaseAnnouncements(client);

		expect(fetchGitHubReleases).toHaveBeenCalledWith({
			owner: "mewtwoop1",
			repo: "zangetsu",
			fullName: "mewtwoop1/zangetsu",
			key: "mewtwoop1/zangetsu",
		});
		expect(channel.send).toHaveBeenCalledTimes(1);
		const payload = jest.mocked(channel.send).mock.calls[0]?.[0];
		expect(payload).toEqual(
			expect.objectContaining({
				content: `<@&${ROLE_ID}>`,
				allowedMentions: { parse: [], roles: [ROLE_ID] },
			}),
		);
		expect(updateTrackedGitHubRelease).toHaveBeenCalledWith(
			GUILD_ID,
			"mewtwoop1",
			"zangetsu",
			publishedRelease.id,
			publishedRelease.published_at,
		);
	});

	it("does not advance the cursor when Discord rejects a message, so the release is retried", async () => {
		const channel = createMockChannel();
		jest.mocked(channel.send).mockRejectedValueOnce(new Error("Missing Permissions"));
		const client = clientWithChannel(channel);

		await checkGitHubReleaseAnnouncements(client);

		expect(updateTrackedGitHubRelease).not.toHaveBeenCalled();
		expect(client.logger.warn).toHaveBeenCalledWith(
			expect.objectContaining({ repository: "mewtwoop1/zangetsu", tag: "v2.0.7" }),
			"[GITHUB_RELEASES] Failed to deliver or record a release; it will be retried.",
		);
	});

	it("does not poll GitHub when no server has opted into announcements", async () => {
		jest.mocked(listReleaseAnnouncementSettings).mockResolvedValueOnce([]);

		await checkGitHubReleaseAnnouncements(createMockClient());

		expect(fetchGitHubReleases).not.toHaveBeenCalled();
	});
});
