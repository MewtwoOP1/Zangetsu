import { type Guild } from "discord.js";
import { type TestifyClient } from "@core/client";
import { toError } from "@core/errors";
import { RaidShieldConfig } from "@database/models/securityFeatures.schema";

interface JoinWindow {
	timestamps: number[];
	lastAlertAt: number | null;
}

const joinWindows = new Map<string, JoinWindow>();

/** Pure burst detection; one alert at most per configured window. */
export function recordJoinBurst(guildId: string, threshold: number, windowMs: number, now = Date.now()): boolean {
	const state = joinWindows.get(guildId) ?? { timestamps: [], lastAlertAt: null };
	state.timestamps = state.timestamps.filter((timestamp) => now - timestamp < windowMs);
	state.timestamps.push(now);
	joinWindows.set(guildId, state);

	if (state.timestamps.length < threshold) return false;
	if (state.lastAlertAt !== null && now - state.lastAlertAt < windowMs) return false;

	state.lastAlertAt = now;
	return true;
}

export function resetJoinBurstStateForTests(): void {
	joinWindows.clear();
}

export async function handleRaidShieldJoin(client: TestifyClient, guild: Guild): Promise<void> {
	const settings = await RaidShieldConfig.findOne({ guildId: guild.id }).lean().exec();
	if (!settings?.enabled) return;

	const windowMs = settings.windowSeconds * 1_000;
	if (!recordJoinBurst(guild.id, settings.threshold, windowMs)) return;

	const channel = settings.alertChannelId
		? await guild.channels.fetch(settings.alertChannelId).catch(() => null)
		: guild.systemChannel;

	if (channel?.isTextBased() !== true || !channel.isSendable()) {
		client.logger.warn({ guildId: guild.id }, "Raid Shield detected a join burst but has no usable alert channel");
		return;
	}

	await channel.send({
		content:
			"Raid Shield warning: a burst of new joins was detected in this server. " +
			"Review the member list and audit log; no members were automatically punished.",
		allowedMentions: { parse: [] },
	}).catch((error: unknown) => {
		client.logger.warn({ err: toError(error), guildId: guild.id }, "Could not send the Raid Shield alert");
	});
}
