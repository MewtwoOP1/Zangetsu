import { z } from "zod";
import { snowflake } from "./schemas";
import { plainLine, plainText } from "./text";

/** The greeting's rules, shared so the form, the API and the Discord panel all enforce the same ones. */

export const WELCOME_LIMITS = {
	maxMessage: 1_500,
	/** Bigger than this and the guild settings document starts to matter. */
	maxBackgroundBytes: 4 * 1024 * 1024,
	maxEmbedTitle: 256,
	maxEmbedAuthor: 256,
	maxEmbedFooter: 2_048,
	maxEmbedUrl: 2_048,
} as const;

export const WELCOME_STYLES = ["text", "embed", "card"] as const;

export type WelcomeStyle = (typeof WELCOME_STYLES)[number];

export function isWelcomeStyle(value: string): value is WelcomeStyle {
	return (WELCOME_STYLES as readonly string[]).includes(value);
}

/** What a greeting can say about the member who just joined; each surface describes them in its own words. */
export const WELCOME_PLACEHOLDERS = ["{user}", "{username}", "{server}", "{count}"] as const;

export type WelcomePlaceholder = (typeof WELCOME_PLACEHOLDERS)[number];

export const DEFAULT_WELCOME_MESSAGE = "Welcome to **{server}**, {user}! You are member **{count}**.";
export const DEFAULT_WELCOME_EMBED_TITLE = "Welcome to {server}";
export const DEFAULT_WELCOME_EMBED_COLOR = "#D6A5E8";

/** Persisted embed fields, with safe defaults for guilds configured before custom embed settings existed. */
export interface WelcomeEmbedSettings {
	embedTitle: string;
	embedColor: string;
	embedAuthor: string;
	embedAuthorIconUrl: string;
	embedFooter: string;
	embedFooterIconUrl: string;
	embedThumbnailUrl: string;
	embedImageUrl: string;
	embedTimestamp: boolean;
}

export const DEFAULT_WELCOME_EMBED_SETTINGS: WelcomeEmbedSettings = {
	embedTitle: DEFAULT_WELCOME_EMBED_TITLE,
	embedColor: DEFAULT_WELCOME_EMBED_COLOR,
	embedAuthor: "",
	embedAuthorIconUrl: "",
	embedFooter: "",
	embedFooterIconUrl: "",
	embedThumbnailUrl: "",
	embedImageUrl: "",
	embedTimestamp: true,
};

export interface GreetingContext {
	mention: string;
	username: string;
	serverName: string;
	memberCount: number;
}

/** Fills the placeholders. The dashboard's preview and the message the bot posts come from this one function. */
export function fillTemplate(template: string, context: GreetingContext): string {
	return template
		.replaceAll("{user}", context.mention)
		.replaceAll("{username}", context.username)
		.replaceAll("{server}", context.serverName)
		.replaceAll("{count}", String(context.memberCount));
}

export interface WelcomeConfigResponse extends WelcomeEmbedSettings {
	/** False when no greeting is configured at all, which is how the bot stores "off". */
	enabled: boolean;
	channelId: string | null;
	message: string;
	style: WelcomeStyle;
	/** The image itself is never sent — it is a Buffer in the database and megabytes on the wire. */
	hasBackground: boolean;
}

function httpUrlOrEmpty(value: string): boolean {
	if (value === "") return true;
	try {
		const url = new URL(value);
		return url.protocol === "http:" || url.protocol === "https:";
	} catch {
		return false;
	}
}

const optionalImageUrl = z
	.string()
	.max(WELCOME_LIMITS.maxEmbedUrl)
	.refine(httpUrlOrEmpty, "must be an HTTP or HTTPS URL, or empty");

export const welcomePatchSchema = z
	.object({
		enabled: z.boolean(),
		channelId: snowflake.nullable(),
		message: plainText(1, WELCOME_LIMITS.maxMessage),
		style: z.enum(WELCOME_STYLES),
		embedTitle: plainLine(0, WELCOME_LIMITS.maxEmbedTitle),
		embedColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "must be a six-digit hex colour"),
		embedAuthor: plainLine(0, WELCOME_LIMITS.maxEmbedAuthor),
		embedAuthorIconUrl: optionalImageUrl,
		embedFooter: plainLine(0, WELCOME_LIMITS.maxEmbedFooter),
		embedFooterIconUrl: optionalImageUrl,
		embedThumbnailUrl: optionalImageUrl,
		embedImageUrl: optionalImageUrl,
		embedTimestamp: z.boolean(),
	})
	.partial()
	.refine((patch) => Object.keys(patch).length > 0, "must change something");

export type WelcomePatch = z.infer<typeof welcomePatchSchema>;
