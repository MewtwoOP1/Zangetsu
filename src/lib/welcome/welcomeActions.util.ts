import { type AttachmentBuilder, type EmbedBuilder, type GuildMember } from "discord.js";
import { type WelcomeSettings } from "@database/models/guildSettings.schema";
import { renderWelcomeCard } from "@lib/canvas/welcomeCard.util";
import { embed } from "@lib/discord/embeds.util";
import { type WelcomeConfig } from "@lib/welcome/welcome.types";
import { fillTemplate, type GreetingContext } from "@lib/welcome/welcome.util";

/** The greeting, built once for the join event, the Preview button and `/welcome test`. */

export interface Greeting {
	content?: string;
	embeds?: EmbedBuilder[];
	files?: AttachmentBuilder[];
	allowedMentions: { users: string[] };
}

export async function greetingFor(
	member: GuildMember,
	config: WelcomeConfig,
	settings: Pick<WelcomeSettings, "background"> | null,
): Promise<Greeting> {
	const greetingContext: GreetingContext = {
		mention: `<@${member.id}>`,
		username: member.user.username,
		serverName: member.guild.name,
		memberCount: member.guild.memberCount,
	};
	const message = fillTemplate(config.message, greetingContext);

	// Only the member being greeted is ever pinged, whatever the template says.
	const allowedMentions = { users: [member.id] };

	if (config.style === "text") return { content: message, allowedMentions };

	if (config.style === "embed") {
		const title = fillTemplate(config.embedTitle, greetingContext);
		const authorName = fillTemplate(config.embedAuthor, greetingContext);
		const footerText = fillTemplate(config.embedFooter, greetingContext);

		return {
			embeds: [
				embed({
					category: "community",
					colour: config.embedColor,
					...(title.length > 0 ? { title } : {}),
					description: message,
					thumbnail: config.embedThumbnailUrl || member.user.displayAvatarURL({ size: 256 }),
					...(config.embedImageUrl ? { image: config.embedImageUrl } : {}),
					...(footerText ? { footer: footerText } : {}),
					...(config.embedFooterIconUrl ? { footerIcon: config.embedFooterIconUrl } : {}),
					...(authorName
						? {
							author: {
								name: authorName,
								...(config.embedAuthorIconUrl ? { iconURL: config.embedAuthorIconUrl } : {}),
							},
						}
						: {}),
					timestamp: config.embedTimestamp,
				}),
			],
			content: `<@${member.id}>`,
			allowedMentions,
		};
	}

	const card = await renderWelcomeCard({
		displayName: member.displayName,
		avatarUrl: member.user.displayAvatarURL({ extension: "png", size: 256 }),
		serverName: member.guild.name,
		memberCount: member.guild.memberCount,
		background: settings?.background?.data ?? null,
	});

	return { content: message, files: [card], allowedMentions };
}
