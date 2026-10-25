import { model, Schema } from "mongoose";

export interface NsfwGuildSettings {
	guildId: string;
	enabled: boolean;
	updatedBy: string | null;
	createdAt: Date;
	updatedAt: Date;
}

const nsfwGuildSchema = new Schema<NsfwGuildSettings>(
	{
		guildId: { type: String, required: true, unique: true },
		enabled: { type: Boolean, required: true, default: false },
		updatedBy: { type: String, default: null },
	},
	{ timestamps: true },
);

export const NsfwGuildConfig = model<NsfwGuildSettings>("nsfwguildsettings", nsfwGuildSchema);

export interface NsfwUserConsent {
	guildId: string;
	userId: string;
	optedIn: boolean;
	allowSuggestive: boolean;
	createdAt: Date;
	updatedAt: Date;
}

const nsfwConsentSchema = new Schema<NsfwUserConsent>(
	{
		guildId: { type: String, required: true },
		userId: { type: String, required: true },
		optedIn: { type: Boolean, required: true, default: false },
		allowSuggestive: { type: Boolean, required: true, default: false },
	},
	{ timestamps: true },
);

nsfwConsentSchema.index({ guildId: 1, userId: 1 }, { unique: true });

export const NsfwConsent = model<NsfwUserConsent>("nsfwconsent", nsfwConsentSchema);
