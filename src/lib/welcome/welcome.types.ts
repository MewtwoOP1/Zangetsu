import { type WelcomeEmbedSettings, type WelcomeStyle } from "@testify/shared";

/** The settings the bot needs after legacy database records have been normalised. */
export interface WelcomeConfig extends WelcomeEmbedSettings {
	channelId: string;
	message: string;
	style: WelcomeStyle;
	hasBackground: boolean;
}
