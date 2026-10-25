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
