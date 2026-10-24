/** Used only before Discord has said what the bot is called. */
export const DEFAULT_BOT_NAME = "Zangetsu";

/** The bot's own Discord username, or the built-in name until Discord has said what it is. */
export function resolveBotName(discord?: string | null): string {
	const name = discord?.trim() ?? "";
	return name === "" ? DEFAULT_BOT_NAME : name;
}
