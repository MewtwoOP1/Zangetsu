import { model, Schema } from "mongoose";

export interface PanicLockRecord {
	guildId: string;
	channelId: string;
	sendMessages: boolean | null;
	sendMessagesInThreads: boolean | null;
	lockedBy: string;
	createdAt: Date;
	updatedAt: Date;
}

const panicLockSchema = new Schema<PanicLockRecord>(
	{
		guildId: { type: String, required: true },
		channelId: { type: String, required: true },
		sendMessages: { type: Boolean, default: null },
		sendMessagesInThreads: { type: Boolean, default: null },
		lockedBy: { type: String, required: true },
	},
	{ timestamps: true },
);

panicLockSchema.index({ guildId: 1, channelId: 1 }, { unique: true });

export const PanicLock = model<PanicLockRecord>("paniclocks", panicLockSchema);

export interface RaidShieldSettings {
	guildId: string;
	enabled: boolean;
	threshold: number;
	windowSeconds: number;
	alertChannelId: string | null;
	updatedBy: string | null;
	createdAt: Date;
	updatedAt: Date;
}

const raidShieldSchema = new Schema<RaidShieldSettings>(
	{
		guildId: { type: String, required: true, unique: true },
		enabled: { type: Boolean, required: true, default: false },
		threshold: { type: Number, required: true, default: 8, min: 3, max: 50 },
		windowSeconds: { type: Number, required: true, default: 30, min: 10, max: 300 },
		alertChannelId: { type: String, default: null },
		updatedBy: { type: String, default: null },
	},
	{ timestamps: true },
);

export const RaidShieldConfig = model<RaidShieldSettings>("raidshieldsettings", raidShieldSchema);
