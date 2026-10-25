import { type ColorResolvable } from "discord.js";
import { CATEGORIES, type Category } from "@config/categories";

/** Colours, emoji and branding. */
export const theme = {
	author: "MewtwoOP1",
	repository: "https://github.com/MewtwoOP1/Zangetsu",
	/** Configure this once the Zangetsu Discord invite URL is available. */
	supportServer: "",
	logoUrl: "https://cdn.discordapp.com/icons/1514592000429654196/c07572fcdd3987826f09fdcd490e9b65.webp?size=2048",
	/** Shared wide banner shown on command embeds. */
	bannerUrl: "https://raw.githubusercontent.com/MewtwoOP1/Zangetsu/feature/command-embed-banner/assets/zangetsu-command-banner.svg",

	/** The only place a colour is written. Everything else names one of these. */
	colours: {
		default: "Blurple",
		error: "Red",
		success: "Green",
		warning: "Yellow",
		info: "Blue",
		audit: "DarkPurple",
		/** A moderator acted, rather than something merely changing. */
		severe: "DarkRed",
		/** Something left or ran out, which is neither a success nor a failure. */
		notice: "Orange",
	} satisfies Record<string, ColorResolvable>,

	/** Plain Unicode only. */
	emoji: {
		error: "❌",
		success: "✅",
		warning: "⚠️",
		info: "ℹ️",
		arrow: "➜",
		auditLog: "📋",
		coin: "🪙",
		bank: "🏦",
		wallet: "👛",
		confetti: "🎉",
		counting: "🔢",
		moderation: "🛡️",
		verify: "🔓",
		first: "⏮️",
		previous: "◀️",
		next: "▶️",
		last: "⏭️",
		tick: "✔️",
		maintenance: "🛠️",
	},
} as const;

export function categoryColour(category: Category): ColorResolvable {
	return CATEGORIES[category].colour;
}
