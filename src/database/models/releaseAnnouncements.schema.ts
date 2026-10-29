import { model, Schema } from "mongoose";

export interface TrackedGitHubRepository {
	owner: string;
	repo: string;
	lastReleaseId: number | null;
	lastReleasePublishedAt: string | null;
}

const trackedGitHubRepositorySchema = new Schema<TrackedGitHubRepository>(
	{
		owner: { type: String, required: true },
		repo: { type: String, required: true },
		lastReleaseId: { type: Number, default: null },
		lastReleasePublishedAt: { type: String, default: null },
	},
	{ _id: false },
);

export interface ReleaseAnnouncementSettings {
	guildId: string;
	channelId: string;
	roleId: string | null;
	repositories: TrackedGitHubRepository[];
	createdAt: Date;
	updatedAt: Date;
}

const releaseAnnouncementSettingsSchema = new Schema<ReleaseAnnouncementSettings>(
	{
		guildId: { type: String, required: true, unique: true },
		channelId: { type: String, required: true },
		roleId: { type: String, default: null },
		repositories: { type: [trackedGitHubRepositorySchema], required: true, default: [] },
	},
	{ timestamps: true },
);

export const ReleaseAnnouncementSettingsModel = model<ReleaseAnnouncementSettings>(
	"ReleaseAnnouncementSettings",
	releaseAnnouncementSettingsSchema,
);
