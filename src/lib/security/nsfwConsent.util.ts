export interface NsfwConsentState {
	optedIn?: boolean;
	allowSuggestive?: boolean;
}

/** Both people must opt in to the module; suggestive actions require a separate opt-in from both. */
export function canUseNsfwAction(
	requiresSuggestiveConsent: boolean,
	actor: NsfwConsentState | null | undefined,
	target: NsfwConsentState | null | undefined,
): boolean {
	if (actor?.optedIn !== true || target?.optedIn !== true) return false;
	if (!requiresSuggestiveConsent) return true;
	return actor.allowSuggestive === true && target.allowSuggestive === true;
}
