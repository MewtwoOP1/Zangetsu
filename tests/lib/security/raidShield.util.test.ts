import { recordJoinBurst, resetJoinBurstStateForTests } from "@lib/security/raidShield.util";

describe("Raid Shield burst detection", () => {
	beforeEach(() => resetJoinBurstStateForTests());

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

	it("does not count joins that are outside the rolling window", () => {
		expect(recordJoinBurst("guild-c", 3, 10_000, 1_000)).toBe(false);
		expect(recordJoinBurst("guild-c", 3, 10_000, 2_000)).toBe(false);
		expect(recordJoinBurst("guild-c", 3, 10_000, 12_001)).toBe(false);
	});
});
