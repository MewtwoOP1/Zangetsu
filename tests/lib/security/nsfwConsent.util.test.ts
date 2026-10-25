import { canUseNsfwAction, canUseNsfwTarget, type NsfwConsentState } from "@lib/security/nsfwConsent.util";

const optedIn: NsfwConsentState = { optedIn: true, allowSuggestive: false };
const optedInSuggestive: NsfwConsentState = { optedIn: true, allowSuggestive: true };

describe("NSFW interaction consent", () => {
	it("requires both participants to opt in to regular text interactions", () => {
		expect(canUseNsfwAction(false, optedIn, optedIn)).toBe(true);
		expect(canUseNsfwAction(false, null, optedIn)).toBe(false);
		expect(canUseNsfwAction(false, optedIn, { optedIn: false })).toBe(false);
	});

	it("requires separate suggestive consent from the actor and target", () => {
		expect(canUseNsfwAction(true, optedInSuggestive, optedInSuggestive)).toBe(true);
		expect(canUseNsfwAction(true, optedIn, optedInSuggestive)).toBe(false);
		expect(canUseNsfwAction(true, optedInSuggestive, optedIn)).toBe(false);
	});

	it("does not treat a legacy consent record with a missing new field as suggestive consent", () => {
		expect(canUseNsfwAction(true, { optedIn: true }, { optedIn: true })).toBe(false);
		expect(canUseNsfwAction(false, { optedIn: true }, { optedIn: true })).toBe(true);
	});

	it("rejects consent from missing records", () => {
		expect(canUseNsfwAction(true, undefined, undefined)).toBe(false);
		expect(canUseNsfwAction(false, undefined, undefined)).toBe(false);
	});

	it("does not let a stored consent record authorize a target who is no longer a server member", () => {
		expect(canUseNsfwTarget(false, false, optedIn, optedIn)).toBe(false);
		expect(canUseNsfwTarget(false, true, optedInSuggestive, optedInSuggestive)).toBe(false);
		expect(canUseNsfwTarget(true, false, optedIn, optedIn)).toBe(true);
	});
});
