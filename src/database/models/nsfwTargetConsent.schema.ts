import { model, Schema } from "mongoose";

export interface NsfwTargetConsentSettings {
	guildId: string;
	userId: string;
	enabled: boolean;
	createdAt: Date;
	updatedAt: Date;
}

const nsfwTargetConsentSchema = new Schema<NsfwTargetConsentSettings>(
	{
		guildId: { type: String, required: true },
		userId: { type: String, required: true },
		enabled: { type: Boolean, required: true, default: false },
	},
	{ timestamps: true },
);

nsfwTargetConsentSchema.index({ guildId: 1, userId: 1 }, { unique: true });

export const NsfwTargetConsent = model<NsfwTargetConsentSettings>("nsfwtargetconsent", nsfwTargetConsentSchema);
