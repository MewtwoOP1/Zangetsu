import { type WelcomeSettings } from "@database/models/guildSettings.schema";
import { type WelcomeConfig } from "@lib/welcome/welcome.types";
import {
	DEFAULT_WELCOME_EMBED_SETTINGS,
	DEFAULT_WELCOME_MESSAGE,
	fillTemplate,
	type GreetingContext,
	isWelcomeStyle,
	WELCOME_LIMITS,
	WELCOME_PLACEHOLDERS,
	type WelcomePlaceholder,
	WELCOME_STYLES,
} from "@testify/shared";

/** The rules of the welcome system, with no Discord objects in sight. */

// Declared in `@testify/shared` so the dashboard's form validates against the same rules.
export {
	DEFAULT_WELCOME_EMBED_SETTINGS,
	DEFAULT_WELCOME_MESSAGE,
	fillTemplate,
	type GreetingContext,
	isWelcomeStyle,
	WELCOME_LIMITS,
	WELCOME_PLACEHOLDERS,
	WELCOME_STYLES,
};

/** What each placeholder stands for, in the words the Discord panel prints beside it. */
export const PLACEHOLDER_HELP: Record<WelcomePlaceholder, string> = {
	"{user}": "Mentions them",
	"{username}": "Their name, unlinked",
	"{server}": "This server's name",
	"{count}": "How many members there are now",
};

type AddedLater = "style" | "background";
export type StoredWelcomeSettings = Omit<WelcomeSettings, AddedLater> & Partial<Pick<WelcomeSettings, AddedLater>>;

/** Folds the old `isEmbed` flag into the three-way style, so no other file knows it existed. */
export function normaliseWelcome(settings: StoredWelcomeSettings | null): WelcomeConfig | null {
	if (settings === null) return null;

	return {
		channelId: settings.channelId,
		message: settings.message,
		style: settings.style ?? (settings.isEmbed ? "embed" : "text"),
		hasBackground: (settings.background?.data.byteLength ?? 0) > 0,
		embedTitle: settings.embedTitle ?? DEFAULT_WELCOME_EMBED_SETTINGS.embedTitle,
		embedColor: settings.embedColor ?? DEFAULT_WELCOME_EMBED_SETTINGS.embedColor,
		embedAuthor: settings.embedAuthor ?? DEFAULT_WELCOME_EMBED_SETTINGS.embedAuthor,
		embedAuthorIconUrl: settings.embedAuthorIconUrl ?? DEFAULT_WELCOME_EMBED_SETTINGS.embedAuthorIconUrl,
		embedFooter: settings.embedFooter ?? DEFAULT_WELCOME_EMBED_SETTINGS.embedFooter,
		embedFooterIconUrl: settings.embedFooterIconUrl ?? DEFAULT_WELCOME_EMBED_SETTINGS.embedFooterIconUrl,
		embedThumbnailUrl: settings.embedThumbnailUrl ?? DEFAULT_WELCOME_EMBED_SETTINGS.embedThumbnailUrl,
		embedImageUrl: settings.embedImageUrl ?? DEFAULT_WELCOME_EMBED_SETTINGS.embedImageUrl,
		embedTimestamp: settings.embedTimestamp ?? DEFAULT_WELCOME_EMBED_SETTINGS.embedTimestamp,
	};
}

export interface BackgroundCheck {
	ok: boolean;
	reason?: string;
}

/** Whether an uploaded file can be used as a card background. */
export function checkBackground(file: {
	contentType: string | null;
	size: number;
	width?: number | null;
}): BackgroundCheck {
	if (!file.contentType?.startsWith("image/")) {
		return { ok: false, reason: "That is not an image. Upload a PNG, JPG or WebP." };
	}

	if (file.contentType.includes("gif")) {
		return { ok: false, reason: "Animated GIFs cannot be used — the card is a still image. Try a PNG or JPG." };
	}

	if (file.size > WELCOME_LIMITS.maxBackgroundBytes) {
		const megabytes = Math.round(WELCOME_LIMITS.maxBackgroundBytes / 1024 / 1024);
		return { ok: false, reason: `That image is too large. Keep it under ${megabytes} MB.` };
	}

	return { ok: true };
}
