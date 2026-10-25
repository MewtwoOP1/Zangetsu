import { RaidShieldConfig } from "@database/models/securityFeatures.schema";
import {
	handleRaidShieldJoin,
	recordJoinBurst,
	resetJoinBurstStateForTests,
} from "@lib/security/raidShield.util";

jest.mock("@database/models/securityFeatures.schema", () => ({
	RaidShieldConfig: { findOne: jest.fn() },
}));

const findOne = jest.mocked(RaidShieldConfig.findOne);

function settings(record: unknown): void {
	findOne.mockReturnValue({ lean: () => ({ exec: () => Promise.resolve(record) }) } as never);
}

describe("Raid Shield burst detection", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		resetJoinBurstStateForTests();
	});

	it("alerts only after the configured number of joins inside the time window", () => {
		expect(recordJoinBurst("guild-a", 3, 30_000, 1_000)).toBe(false);
		expect(recordJoinBurst("guild-a", 3, 30_000, 2_000)).toBe(false);
		expect(recordJoinBurst("guild-a", 3, 30_000, 3_000)).toBe(true);
	});

	it("suppresses duplicate alerts during the cooldown window", () => {
		recordJoinBurst("guild-b", 3, 30_000, 1_000);
		recordJoinBurst("guild-b", 3, 30_000, 2_000);
		expect(recordJoinBurst("guild-b", 3, 30_000, 3_000)).toBe(true);
		expect(recordJoinBurst("guild-b", 3, 30_000, 4_000)).toBe(false);
	});

	it("does not count joins that are outside a rolling window", () => {
		expect(recordJoinBurst("guild-c", 3, 10_000, 1_000)).toBe(false);
		expect(recordJoinBurst("guild-c", 3, 10_000, 2_000)).toBe(false);
		expect(recordJoinBurst("guild-c", 3, 10_000, 12_001)).toBe(false);
	});

	it("does not alert when no settings record exists", async () => {
		settings(null);
		const client = { logger: { warn: jest.fn() } };
		const send = jest.fn();
		const guild = { id: "guild-unconfigured", systemChannel: { send }, channels: { fetch: jest.fn() } };

		await handleRaidShieldJoin(client as never, guild as never);

		expect(send).not.toHaveBeenCalled();
		expect(client.logger.warn).not.toHaveBeenCalled();
	});

	it("does not send alerts when the feature is disabled", async () => {
		settings({ enabled: false });
		const send = jest.fn();
		const guild = { id: "guild-disabled", systemChannel: { send }, channels: { fetch: jest.fn() } };
		const client = { logger: { warn: jest.fn() } };

		await handleRaidShieldJoin(client as never, guild as never);

		expect(send).not.toHaveBeenCalled();
	});

	it("logs no-channel warning when the configured alert channel cannot be fetched", async () => {
		settings({ enabled: true, threshold: 3, windowSeconds: 30, alertChannelId: "missing" });
		const fetch = jest.fn().mockRejectedValue(new Error("Unknown channel"));
		const client = { logger: { warn: jest.fn() } };
		const guild = { id: "guild-missing-channel", systemChannel: null, channels: { fetch } };

		await handleRaidShieldJoin(client as never, guild as never);
		await handleRaidShieldJoin(client as never, guild as never);
		await handleRaidShieldJoin(client as never, guild as never);

		expect(fetch).toHaveBeenCalledWith("missing");
		expect(client.logger.warn).toHaveBeenCalledWith(
			{ guildId: "guild-missing-channel" },
			"Raid Shield detected a join burst but has no usable alert channel",
		);
	});

	it("alerts the system channel once the configured join threshold is reached", async () => {
		settings({ enabled: true, threshold: 3, windowSeconds: 30, alertChannelId: null });
		const send = jest.fn().mockResolvedValue(undefined);
		const channel = { isTextBased: () => true, isSendable: () => true, send };
		const guild = { id: "guild-alert", systemChannel: channel, channels: { fetch: jest.fn() } };
		const client = { logger: { warn: jest.fn() } };

		await handleRaidShieldJoin(client as never, guild as never);
		await handleRaidShieldJoin(client as never, guild as never);
		await handleRaidShieldJoin(client as never, guild as never);

		expect(send).toHaveBeenCalledTimes(1);
		expect(send).toHaveBeenCalledWith(
			expect.objectContaining({
				content: expect.stringContaining("no members were automatically punished"),
				allowedMentions: { parse: [] },
			}),
		);
	});

	it("uses an explicitly configured alert channel instead of the system channel", async () => {
		settings({ enabled: true, threshold: 3, windowSeconds: 30, alertChannelId: "alert-channel" });
		const send = jest.fn().mockResolvedValue(undefined);
		const channel = { isTextBased: () => true, isSendable: () => true, send };
		const fetch = jest.fn().mockResolvedValue(channel);
		const guild = { id: "guild-explicit-channel", systemChannel: null, channels: { fetch } };
		const client = { logger: { warn: jest.fn() } };

		await handleRaidShieldJoin(client as never, guild as never);
		await handleRaidShieldJoin(client as never, guild as never);
		await handleRaidShieldJoin(client as never, guild as never);

		expect(fetch).toHaveBeenCalledWith("alert-channel");
		expect(send).toHaveBeenCalledTimes(1);
	});

	it("logs a warning rather than rejecting when sending the alert fails", async () => {
		settings({ enabled: true, threshold: 3, windowSeconds: 30, alertChannelId: null });
		const send = jest.fn().mockRejectedValue(new Error("Missing permissions"));
		const channel = { isTextBased: () => true, isSendable: () => true, send };
		const guild = { id: "guild-send-failure", systemChannel: channel, channels: { fetch: jest.fn() } };
		const client = { logger: { warn: jest.fn() } };

		await handleRaidShieldJoin(client as never, guild as never);
		await handleRaidShieldJoin(client as never, guild as never);
		await handleRaidShieldJoin(client as never, guild as never);

		expect(client.logger.warn).toHaveBeenCalledWith(
			expect.objectContaining({ guildId: "guild-send-failure", err: expect.any(Error) }),
			"Could not send the Raid Shield alert",
		);
	});

	it("logs a warning when the alert channel cannot send messages", async () => {
		settings({ enabled: true, threshold: 3, windowSeconds: 30, alertChannelId: null });
		const client = { logger: { warn: jest.fn() } };
		const channel = { isTextBased: () => true, isSendable: () => false };
		const guild = { id: "guild-not-sendable", systemChannel: channel, channels: { fetch: jest.fn() } };

		await handleRaidShieldJoin(client as never, guild as never);
		await handleRaidShieldJoin(client as never, guild as never);
		await handleRaidShieldJoin(client as never, guild as never);

		expect(client.logger.warn).toHaveBeenCalledWith(
			{ guildId: "guild-not-sendable" },
			"Raid Shield detected a join burst but has no usable alert channel",
		);
	});

	it("logs a warning instead of failing when no sendable alert channel exists", async () => {
		settings({ enabled: true, threshold: 3, windowSeconds: 30, alertChannelId: null });
		const client = { logger: { warn: jest.fn() } };
		const guild = { id: "guild-no-channel", systemChannel: null, channels: { fetch: jest.fn() } };

		await handleRaidShieldJoin(client as never, guild as never);
		await handleRaidShieldJoin(client as never, guild as never);
		await handleRaidShieldJoin(client as never, guild as never);

		expect(client.logger.warn).toHaveBeenCalledWith(
			{ guildId: "guild-no-channel" },
			"Raid Shield detected a join burst but has no usable alert channel",
		);
	});
});
