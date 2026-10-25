import { PermissionFlagsBits } from "discord.js";
import { type CommandInput, defineCommand, inGuild } from "@core/command";
import { UserFacingError } from "@core/errors";
import { NsfwGuildConfig } from "@database/models/nsfw.schema";
import { embed, reply } from "@lib/discord";
import {
	buildNsfwActionLine,
	fetchNsfwGif,
	NSFW_GIF_CATEGORIES,
	NsfwGifConfigurationError,
	type NsfwGifCategory,
} from "@lib/nsfw/nsfwGif.util";

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
		fuck: "Fuck",
		anal: "Anal",
		blowjob: "Blowjob",
		bj: "Blowjob",
		boobjob: "Boobjob",
		bz: "Boobjob",
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
								"Fetch adult anime/hentai GIFs with /nsfw gif, /nsfw fuck, /nsfw anal, /nsfw blowjob (or /nsfw bj), /nsfw boobjob (or /nsfw bz), /nsfw tits, /nsfw ass, /nsfw pussy, /nsfw cum, /nsfw handjob, /nsfw hentai, /nsfw lesbian, /nsfw threesome, or /nsfw random. " +
								"Each GIF command accepts an optional target and adds an action caption. Mentions do not send notifications. The server module must be enabled, and commands only work in age-restricted Discord channels. Adult-only filtering is applied, but external tags and ratings are not infallible.",
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
								"\nUser targeting: optional, no consent gate",
						}),
					],
				});
			},
		},
		...NSFW_GIF_CATEGORIES.map((category) => ({
			name: category,
			description: `Fetch a random adult hentai GIF for the ${categoryLabel(category).toLowerCase()} category.`,
			options: [
				{
					name: "target",
					description: "Optional member to name in the action caption; no ping is sent.",
					type: "user" as const,
					required: false,
				},
			],
			async run(interaction: CommandInput) {
				const guild = inGuild(interaction);
				await requireEnabledNsfwChannel(interaction, guild.id);

				const target = interaction.options.getUser("target");
				const actorName =
					guild.members.cache.get(interaction.user.id)?.displayName ??
					interaction.user.globalName ??
					interaction.user.username;
				const targetName = target
					? (guild.members.cache.get(target.id)?.displayName ?? target.globalName ?? target.username)
					: null;

				let result: Awaited<ReturnType<typeof fetchNsfwGif>>;
				try {
					result = await fetchNsfwGif(category);
				} catch (error) {
					if (error instanceof NsfwGifConfigurationError) {
						throw new UserFacingError(error.message);
					}
					throw new UserFacingError("The GIF provider is temporarily unavailable. Please try again shortly.");
				}

				if (!result) {
					throw new UserFacingError(
						`No matching animated GIF was found for ${categoryLabel(category).toLowerCase()}. Try the /nsfw gif or /nsfw random command.`,
					);
				}

				await reply(interaction, {
					...(targetName ? { content: buildNsfwActionLine(category, actorName, targetName) } : {}),
					embeds: [
						embed({
							category: "fun",
							title: `${categoryLabel(category)} hentai GIF`,
							description: "Animated adult GIF. Click the title to view the source post.",
							url: result.postUrl,
							image: result.fileUrl,
						}),
					],
					allowedMentions: { parse: [] },
				});
			},
		})),
	],
});
