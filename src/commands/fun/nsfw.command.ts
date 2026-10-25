import { PermissionFlagsBits } from "discord.js";
import { type CommandInput, defineCommand, inGuild } from "@core/command";
import { UserFacingError } from "@core/errors";
import { NsfwGuildConfig } from "@database/models/nsfw.schema";
import { NsfwTargetConsent } from "@database/models/nsfwTargetConsent.schema";
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
								"Each GIF command accepts an optional target. Other members must opt in with /nsfw consent enabled:true before they can be targeted; mentions do not send notifications. The server module must be enabled, and commands only work in age-restricted Discord channels. Adult-only filtering is applied, but external tags and ratings are not infallible.",
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
								"\nUser targeting: opt-in required",
						}),
					],
				});
			},
		},
		{
			name: "consent",
			description: "Choose whether other members may target you in NSFW action captions.",
			options: [
				{
					name: "enabled",
					description: "Allow other members to include you in NSFW action captions.",
					type: "boolean",
					required: true,
				},
			],
			async run(interaction: CommandInput) {
				const guild = inGuild(interaction);
				await requireEnabledNsfwChannel(interaction, guild.id);
				const enabled = interaction.options.getBoolean("enabled", true);
				await NsfwTargetConsent.findOneAndUpdate(
					{ guildId: guild.id, userId: interaction.user.id },
					{ $set: { enabled } },
					{ upsert: true, new: true, setDefaultsOnInsert: true },
				).exec();
				await reply(interaction, {
					embeds: [
						embed({
							category: "fun",
							title: enabled ? "NSFW targeting enabled" : "NSFW targeting disabled",
							description: enabled
								? "Other members may now target you in NSFW action captions in this server. Use /nsfw consent enabled:false to opt out."
								: "Other members can no longer target you in NSFW action captions in this server.",
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
					description: "Optional member for the action caption (requires their opt-in).",
					type: "user" as const,
					required: false,
				},
			],
			async run(interaction: CommandInput) {
				const guild = inGuild(interaction);
				await requireEnabledNsfwChannel(interaction, guild.id);

				const target = interaction.options.getUser("target");
				if (target && target.id !== interaction.user.id) {
					const targetConsent = await NsfwTargetConsent.findOne({ guildId: guild.id, userId: target.id }).lean().exec();
					if (targetConsent?.enabled !== true) {
						throw new UserFacingError(`${target.username} has not opted in to NSFW action captions. They can opt in with /nsfw consent enabled:true.`);
					}
				}

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
					embeds: [
						embed({
							category: "fun",
							title: `${categoryLabel(category)} hentai GIF`,
							description: target
								? `${buildNsfwActionLine(category, interaction.user.id, target.id)}

Animated adult GIF. Click the title to view the source post.`
								: "Animated adult GIF. Click the title to view the source post.",
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
