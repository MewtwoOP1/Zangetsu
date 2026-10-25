import { PermissionFlagsBits } from "discord.js";
import { type CommandInput, defineCommand, inGuild } from "@core/command";
import { UserFacingError } from "@core/errors";
import { NsfwGuildConfig } from "@database/models/nsfw.schema";
import { embed, reply } from "@lib/discord";
import { fetchNsfwGif, NSFW_GIF_CATEGORIES, type NsfwGifCategory } from "@lib/nsfw/nsfwGif.util";

async function requireEnabledNsfwChannel(interaction: CommandInput, guildId: string): Promise<void> {
	const channel = interaction.channel;
	if (!channel || !("nsfw" in channel) || channel.nsfw !== true) {
		throw new UserFacingError("Hentai GIF commands only work inside a Discord age-restricted channel.");
	}

	const settings = await NsfwGuildConfig.findOne({ guildId }).lean().exec();
	if (settings?.enabled !== true) {
		throw new UserFacingError("The server has not enabled this module. A server manager can use /nsfw enable.");
	}
}

function categoryLabel(category: NsfwGifCategory): string {
	const labels: Record<NsfwGifCategory, string> = {
		gif: "Random hentai",
		random: "Random hentai",
		fuck: "Sex",
		anal: "Anal",
		blowjob: "Blowjob",
		tits: "Breasts",
		ass: "Ass",
		pussy: "Pussy",
		cum: "Cum",
		handjob: "Handjob",
		hentai: "Hentai",
		lesbian: "Lesbian",
		threesome: "Threesome",
	};
	return labels[category];
}

export default defineCommand({
	name: "nsfw",
	description: "Find adult hentai GIFs in age-restricted channels.",
	category: "fun",
	guildOnly: true,
	nsfw: true,
	cooldown: 5_000,
	subcommands: [
		{
			name: "help",
			description: "Show hentai GIF categories and module requirements.",
			async run(interaction) {
				await reply(interaction, {
					embeds: [
						embed({
							category: "fun",
							title: "NSFW GIF commands",
							description:
								"Fetch adult anime/hentai GIFs with /nsfw gif, /nsfw fuck, /nsfw anal, /nsfw blowjob, /nsfw tits, /nsfw ass, /nsfw pussy, /nsfw cum, /nsfw handjob, /nsfw hentai, /nsfw lesbian, /nsfw threesome, or /nsfw random. " +
								"GIF commands are standalone searches and never target or mention another member. The server module must be enabled, and commands only work in age-restricted Discord channels. Adult-only filtering is applied, but external tags and ratings are not infallible.",
						}),
					],
					allowedMentions: { parse: [] },
				});
			},
		},
		{
			name: "enable",
			description: "Enable hentai GIF commands for this server.",
			permissions: [PermissionFlagsBits.ManageGuild],
			async run(interaction) {
				const guild = inGuild(interaction);
				await NsfwGuildConfig.findOneAndUpdate(
					{ guildId: guild.id },
					{ $set: { enabled: true, updatedBy: interaction.user.id } },
					{ upsert: true, new: true, setDefaultsOnInsert: true },
				).exec();
				await reply(interaction, {
					embeds: [
						embed({
							category: "fun",
							title: "NSFW GIF module enabled",
							description: "Adult hentai GIF search is enabled for age-restricted channels. Use /nsfw disable to turn it off.",
						}),
					],
				});
			},
		},
		{
			name: "disable",
			description: "Disable hentai GIF commands for this server.",
			permissions: [PermissionFlagsBits.ManageGuild],
			async run(interaction) {
				const guild = inGuild(interaction);
				await NsfwGuildConfig.findOneAndUpdate(
					{ guildId: guild.id },
					{ $set: { enabled: false, updatedBy: interaction.user.id } },
					{ upsert: true, new: true, setDefaultsOnInsert: true },
				).exec();
				await reply(interaction, {
					embeds: [
						embed({
							category: "fun",
							title: "NSFW GIF module disabled",
							description: "Hentai GIF retrieval is disabled for this server.",
						}),
					],
				});
			},
		},
		{
			name: "settings",
			description: "Show the module status and filtering details.",
			permissions: [PermissionFlagsBits.ManageGuild],
			async run(interaction) {
				const guild = inGuild(interaction);
				const settings = await NsfwGuildConfig.findOne({ guildId: guild.id }).lean().exec();
				await reply(interaction, {
					embeds: [
						embed({
							category: "fun",
							title: "NSFW GIF settings",
							description:
								"Status: " +
								(settings?.enabled === true ? "enabled" : "disabled") +
								"\nProvider: Rule34 public post API" +
								"\nMedia: animated GIF files only" +
								"\nRating: explicit only" +
								"\nChannel: Discord age-restricted channels only" +
								"\nPer-user opt-in: not required for GIF retrieval" +
								"\nTargeted member interactions: not provided",
						}),
					],
				});
			},
		},
		...NSFW_GIF_CATEGORIES.map((category) => ({
			name: category,
			description: `Fetch a random adult hentai GIF for the ${categoryLabel(category).toLowerCase()} category.`,
			async run(interaction: CommandInput) {
				const guild = inGuild(interaction);
				await requireEnabledNsfwChannel(interaction, guild.id);

				let result: Awaited<ReturnType<typeof fetchNsfwGif>>;
				try {
					result = await fetchNsfwGif(category);
				} catch {
					throw new UserFacingError("The GIF provider is temporarily unavailable. Please try again shortly.");
				}

				if (!result) {
					throw new UserFacingError(
						`No matching animated GIF was found for ${categoryLabel(category).toLowerCase()}. Try the /nsfw gif or /nsfw random command.`,
					);
				}

				await reply(interaction, {
					content: result.fileUrl,
					embeds: [
						embed({
							category: "fun",
							title: `${categoryLabel(category)} hentai GIF`,
							description: "Adult anime media from Rule34. Open the source post for tags and attribution.",
							url: result.postUrl,
						}),
					],
					allowedMentions: { parse: [] },
				});
			},
		})),
	],
});
