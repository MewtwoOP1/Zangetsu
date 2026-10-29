import {
	ReleaseAnnouncementSettingsModel,
	type ReleaseAnnouncementSettings,
	type TrackedGitHubRepository,
} from "@database/models/releaseAnnouncements.schema";

const UPSERT = { upsert: true as const, new: true as const, lean: true as const, setDefaultsOnInsert: true as const };

export async function getReleaseAnnouncementSettings(guildId: string): Promise<ReleaseAnnouncementSettings | null> {
	return ReleaseAnnouncementSettingsModel.findOne({ guildId }).lean<ReleaseAnnouncementSettings>().exec();
}

export async function listReleaseAnnouncementSettings(): Promise<ReleaseAnnouncementSettings[]> {
	return ReleaseAnnouncementSettingsModel.find().lean<ReleaseAnnouncementSettings[]>().exec();
}

export async function setReleaseAnnouncementTarget(
	guildId: string,
	channelId: string,
	roleId: string | null,
): Promise<ReleaseAnnouncementSettings> {
	return ReleaseAnnouncementSettingsModel.findOneAndUpdate(
		{ guildId },
		{ $set: { channelId, roleId } },
		UPSERT,
	)
		.lean<ReleaseAnnouncementSettings>()
		.exec() as Promise<ReleaseAnnouncementSettings>;
}

export async function addTrackedGitHubRepository(
	guildId: string,
	repository: TrackedGitHubRepository,
): Promise<boolean> {
	const result = await ReleaseAnnouncementSettingsModel.updateOne(
		{
			guildId,
			repositories: { $not: { $elemMatch: { owner: repository.owner, repo: repository.repo } } },
		},
		{ $push: { repositories: repository } },
	).exec();

	return result.modifiedCount > 0;
}

export async function removeTrackedGitHubRepository(
	guildId: string,
	owner: string,
	repo: string,
): Promise<boolean> {
	const result = await ReleaseAnnouncementSettingsModel.updateOne(
		{ guildId },
		{ $pull: { repositories: { owner, repo } } },
	).exec();

	return result.modifiedCount > 0;
}

export async function updateTrackedGitHubRelease(
	guildId: string,
	owner: string,
	repo: string,
	releaseId: number,
	publishedAt: string,
): Promise<void> {
	await ReleaseAnnouncementSettingsModel.updateOne(
		{ guildId, repositories: { $elemMatch: { owner, repo } } },
		{
			$set: {
				"repositories.$.lastReleaseId": releaseId,
				"repositories.$.lastReleasePublishedAt": publishedAt,
			},
		},
	).exec();
}

export async function purgeReleaseAnnouncementSettings(guildId: string): Promise<void> {
	await ReleaseAnnouncementSettingsModel.deleteMany({ guildId }).exec();
}
