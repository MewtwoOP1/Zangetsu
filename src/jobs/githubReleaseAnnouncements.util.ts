import { type TestifyClient } from "@core/client";
import { toError } from "@core/errors";
import {
	listReleaseAnnouncementSettings,
	updateTrackedGitHubRelease,
} from "@database/repositories/releaseAnnouncementRepository";
import {
	fetchGitHubReleases,
	formatGitHubReleaseAnnouncement,
	releasesAfterCursor,
	type GitHubRelease,
	type GitHubRepository,
} from "@lib/releases";

function repositoryOf(owner: string, repo: string): GitHubRepository {
	const key = `${owner.toLowerCase()}/${repo.toLowerCase()}`;
	return { owner, repo, fullName: key, key };
}

function announcementPayload(repository: GitHubRepository, release: GitHubRelease, roleId: string | null) {
	const announcement = formatGitHubReleaseAnnouncement(repository, release);
	return {
		content: roleId === null ? announcement : `<@&${roleId}>\n${announcement}`,
		allowedMentions: { parse: [], roles: roleId === null ? [] : [roleId] },
	};
}

export async function checkGitHubReleaseAnnouncements(client: TestifyClient): Promise<void> {
	const settings = await listReleaseAnnouncementSettings();
	if (settings.length === 0) return;

	const repositories = new Map<string, GitHubRepository>();
	for (const guildSettings of settings) {
		for (const tracked of guildSettings.repositories) {
			const repository = repositoryOf(tracked.owner, tracked.repo);
			repositories.set(repository.key, repository);
		}
	}

	const feeds = new Map<string, GitHubRelease[]>();
	await Promise.all(
		[...repositories.values()].map(async (repository) => {
			try {
				feeds.set(repository.key, await fetchGitHubReleases(repository));
			} catch (error) {
				client.logger.warn(
					{ err: toError(error), repository: repository.fullName },
					"[GITHUB_RELEASES] Failed to check a repository; it will be retried.",
				);
			}
		}),
	);

	for (const guildSettings of settings) {
		const channel = await client.channels.fetch(guildSettings.channelId).catch(() => null);
		if (
			!channel?.isTextBased() ||
			!channel.isSendable() ||
			!("guildId" in channel) ||
			channel.guildId !== guildSettings.guildId
		) {
			client.logger.warn(
				{ guildId: guildSettings.guildId, channelId: guildSettings.channelId },
				"[GITHUB_RELEASES] The announcement channel is unavailable, not sendable, or belongs to another server.",
			);
			continue;
		}

		for (const tracked of guildSettings.repositories) {
			const repository = repositoryOf(tracked.owner, tracked.repo);
			const releases = feeds.get(repository.key);
			if (releases === undefined) continue;

			const pending = releasesAfterCursor(releases, tracked.lastReleaseId, tracked.lastReleasePublishedAt);
			for (const release of pending) {
				try {
					await channel.send(announcementPayload(repository, release, guildSettings.roleId));
					if (release.published_at === null) continue;
					await updateTrackedGitHubRelease(
						guildSettings.guildId,
						tracked.owner,
						tracked.repo,
						release.id,
						release.published_at,
					);
					client.logger.info(
						{ guildId: guildSettings.guildId, repository: repository.fullName, tag: release.tag_name },
						"[GITHUB_RELEASES] Posted a release announcement.",
					);
				} catch (error) {
					client.logger.warn(
						{
							err: toError(error),
							guildId: guildSettings.guildId,
							repository: repository.fullName,
							tag: release.tag_name,
						},
						"[GITHUB_RELEASES] Failed to deliver or record a release; it will be retried.",
					);
					break;
				}
			}
		}
	}
}
