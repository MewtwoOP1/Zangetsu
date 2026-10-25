import { model, Schema } from "mongoose";
import { DEFAULT_MUSIC_SOURCES, MUSIC_SOURCE_CHOICES, type MusicSourceChoice } from "@testify/shared";

/** Settings the bot's owner makes for every server at once: a single row, keyed `GLOBAL`. */
export interface BotSettingsRecord {
	scope: string;
	musicSources: MusicSourceChoice;
	/** Who last changed it, for the audit trail the dashboard writes alongside. */
	updatedBy: string | null;
	createdAt: Date;
	updatedAt: Date;
}

const botSettingsSchema = new Schema<BotSettingsRecord>(
	{
		scope: { type: String, required: true, unique: true },
		musicSources: { type: String, enum: MUSIC_SOURCE_CHOICES, required: true, default: DEFAULT_MUSIC_SOURCES },
		updatedBy: { type: String, default: null },
	},
	{ timestamps: true },
);

export const BotSettingsConfig = model<BotSettingsRecord>("botsettings", botSettingsSchema);
