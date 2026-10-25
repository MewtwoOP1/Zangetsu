import { PermissionFlagsBits } from "discord.js";
import { type CommandInput, defineCommand, inGuild } from "@core/command";
import { UserFacingError } from "@core/errors";
import { NsfwConsent, NsfwGuildConfig } from "@database/models/nsfw.schema";
import { embed, reply } from "@lib/discord";
import { canUseNsfwAction, type NsfwConsentState } from "@lib/security";

const ACTIONS = [
	{ name: "hug", text: "shares a friendly hug with", suggestive: false },
	{ name: "kiss", text: "shares a playful, non-graphic kiss with", suggestive: false },
	{ name: "cuddle", text: "settles in for a cozy cuddle with", suggestive: false },
	{ name: "flirt", text: "tries a little harmless flirting with", suggestive: false },
	{ name: "tease", text: "offers a lighthearted tease to", suggestive: false },
	{ name: "slap", text: "gives a clearly playful, fictional slap to", suggestive: false },
	{ name: "rizz", text: "attempts an over-the-top pickup line on", suggestive: false },
	{ name: "fuck", text: "keeps the scene suggestive and off-screen with", suggestive: true },
	{ name: "anal", text: "keeps the scene non-graphic and off-screen with", suggestive: true },
] as const;

const RANDOM_LINES = [
	"Keep it playful, non-graphic, and consensual.",
	"A dramatic romance scene starts, then politely cuts to the credits.",
	"Flirting level: chaotic. Boundaries still apply.",
	"The scene fades to black; communication and consent stay on-screen.",
];

async function isOptedIn(guildId: string, userId: string): Promise<boolean> {
	const consent = await NsfwConsent.findOne({ guildId, userId }).lean().exec();
	return consent?.optedIn === true;
}

async function requireEnabledNsfwChannel(
	interaction: CommandInput,
	guildId: string,
): Promise<NsfwConsentState> {
	const channel = interaction.channel;
	if (!channel || !("nsfw" in channel) || channel.nsfw !== true) {
		throw new UserFacingError("Interactions work only inside a Discord age-restricted channel.");
	}

	const settings = await NsfwGuildConfig.findOne({ guildId }).lean().exec();
	if (settings?.enabled !== true) {
		throw new UserFacingError("The server has not enabled this module. A server manager can use /nsfw enable.");
	}

	const consent = await NsfwConsent.findOne({ guildId, userId: interaction.user.id }).lean().exec();
	if (consent?.optedIn !== true) {
		throw new UserFacingError("Opt in first with /nsfw opt-in. You can opt out at any time.");
	}

	return { optedIn: true, allowSuggestive: consent.allowSuggestive === true };
}

export default defineCommand({
	name: "nsfw",
	description: "Consent-gated, text-only interactions for age-restricted channels.",
	category: "fun",
	guildOnly: true,
	private: true,
	subcommands: [
		{
			name: "help",
			description: "Explain the module, its safeguards, and available interactions.",
			async run(interaction) {
				await reply(interaction, {
					embeds: [
						embed({
							category: "fun",
							title: "NSFW module help",
							description:
								"This module is disabled by default and provides text-only, non-graphic interactions. " +
								"It does not fetch or distribute explicit images or videos. A server manager must enable it, " +
								"interactions must be in a Discord age-restricted channel, and both people must opt in. " +
								"The /nsfw fuck and /nsfw anal commands need an additional /nsfw opt-in-suggestive from both people. " +
								"Use /nsfw opt-out or /nsfw opt-out-suggestive to withdraw consent.\n\nAvailable interactions: " +
								ACTIONS.map((action) => action.name).join(", ") +
								", plus /nsfw random.",
						}),
					],
					allowedMentions: { parse: [] },
				});
			},
		},
		{
			name: "enable",
			description: "Enable the text-only interactions module for this server.",
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
							title: "NSFW text module enabled",
							description: "Only non-graphic text interactions are available. Use /nsfw disable to turn the module off.",
						}),
					],
				});
			},
		},
		{
			name: "disable",
			description: "Disable the text-only interactions module for this server.",
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
							title: "NSFW text module disabled",
							description: "All interactions are now disabled for this server.",
						}),
					],
				});
			},
		},
		{
			name: "settings",
			description: "Show whether the module is enabled.",
			permissions: [PermissionFlagsBits.ManageGuild],
			async run(interaction) {
				const guild = inGuild(interaction);
				const settings = await NsfwGuildConfig.findOne({ guildId: guild.id }).lean().exec();
				await reply(interaction, {
					embeds: [
						embed({
							category: "fun",
							title: "NSFW module settings",
							description:
								"Status: " + (settings?.enabled === true ? "enabled" : "disabled") +
								"\nContent: text only, non-graphic" +
								"\nChannel: Discord age-restricted channels only" +
								"\nConsent: both participants opt in" +
								"\nSuggestive actions: separate opt-in required" +
								"\nMedia providers: none",
						}),
					],
				});
			},
		},
		{
			name: "opt-in",
			description: "Opt in to non-graphic text interactions in this server.",
			async run(interaction) {
				const guild = inGuild(interaction);
				await NsfwConsent.findOneAndUpdate(
					{ guildId: guild.id, userId: interaction.user.id },
					{ $set: { optedIn: true } },
					{ upsert: true, new: true, setDefaultsOnInsert: true },
				).exec();
				await reply(interaction, {
					embeds: [
						embed({
							category: "fun",
							title: "Consent saved",
							description: "You opted in for this server. You can use /nsfw opt-out at any time.",
						}),
					],
				});
			},
		},
		{
			name: "opt-out",
			description: "Withdraw consent for interactions in this server at any time.",
			async run(interaction) {
				const guild = inGuild(interaction);
				await NsfwConsent.findOneAndUpdate(
					{ guildId: guild.id, userId: interaction.user.id },
					{ $set: { optedIn: false, allowSuggestive: false } },
					{ upsert: true, new: true, setDefaultsOnInsert: true },
				).exec();
				await reply(interaction, {
					embeds: [
						embed({
							category: "fun",
							title: "Consent withdrawn",
							description: "You are opted out. This works even when the module is disabled.",
						}),
					],
				});
			},
		},
		{
			name: "opt-in-suggestive",
			description: "Separately opt in to non-graphic suggestive, fade-to-black interactions.",
			async run(interaction) {
				const guild = inGuild(interaction);
				if (!(await isOptedIn(guild.id, interaction.user.id))) {
					throw new UserFacingError("Use /nsfw opt-in first, then grant this separate opt-in.");
				}

				await NsfwConsent.findOneAndUpdate(
					{ guildId: guild.id, userId: interaction.user.id },
					{ $set: { optedIn: true, allowSuggestive: true } },
					{ upsert: true, new: true, setDefaultsOnInsert: true },
				).exec();

				await reply(interaction, {
					embeds: [
						embed({
							category: "fun",
							title: "Suggestive consent saved",
							description:
								"You separately opted in to non-graphic suggestive interactions. Other participants must do the same. " +
								"Use /nsfw opt-out-suggestive or /nsfw opt-out any time to withdraw consent.",
						}),
					],
				});
			},
		},
		{
			name: "opt-out-suggestive",
			description: "Withdraw your separate opt-in to suggestive interactions.",
			async run(interaction) {
				const guild = inGuild(interaction);
				await NsfwConsent.findOneAndUpdate(
					{ guildId: guild.id, userId: interaction.user.id },
					{ $set: { allowSuggestive: false } },
					{ upsert: true, new: true, setDefaultsOnInsert: true },
				).exec();

				await reply(interaction, {
					embeds: [
						embed({
							category: "fun",
							title: "Suggestive consent withdrawn",
							description:
								"Suggestive interactions are no longer allowed for you. " +
								"Your basic interaction preference is unchanged.",
						}),
					],
				});
			},
		},
		{
			name: "random",
			description: "Get a random non-graphic text prompt.",
			async run(interaction) {
				const guild = inGuild(interaction);
				await requireEnabledNsfwChannel(interaction, guild.id);
				const line =
					RANDOM_LINES[Math.floor(Math.random() * RANDOM_LINES.length)] ??
					"Keep it playful, non-graphic, and consensual.";
				await reply(interaction, { embeds: [embed({ category: "fun", title: "Random prompt", description: line })] });
			},
		},
		...ACTIONS.map((action) => ({
			name: action.name,
			description: action.suggestive
				? "Run a separately consented, suggestive fade-to-black interaction."
				: "Run a consent-gated, non-graphic text interaction.",
			options: [
				{
					name: "target",
					description: "The other person (they must have opted in too).",
					type: "user" as const,
					required: true,
				},
			],
			async run(interaction: CommandInput) {
				const guild = inGuild(interaction);
				const actorConsent = await requireEnabledNsfwChannel(interaction, guild.id);
				const target = interaction.options.getUser("target", true);
				if (target.bot) throw new UserFacingError("Bot accounts cannot be interaction targets.");
				if (target.id === interaction.user.id) throw new UserFacingError("Choose another person who has opted in.");
				const targetConsent = await NsfwConsent.findOne({ guildId: guild.id, userId: target.id }).lean().exec();
				if (targetConsent?.optedIn !== true) {
					throw new UserFacingError(
						"That person has not opted in for this server. Do not pressure them; they can choose /nsfw opt-in themselves.",
					);
				}
				if (!canUseNsfwAction(action.suggestive, actorConsent, targetConsent)) {
					if (action.suggestive === true && actorConsent.allowSuggestive !== true) {
						throw new UserFacingError("Use /nsfw opt-in-suggestive to separately opt in before using this action.");
					}
					if (action.suggestive === true && targetConsent.allowSuggestive !== true) {
						throw new UserFacingError(
							"That person has not separately opted in to suggestive interactions. Do not pressure them.",
						);
					}
					throw new UserFacingError("Both participants must opt in before this interaction can run.");
				}

				await reply(interaction, {
					embeds: [
						embed({
							category: "fun",
							title: "Consent-gated interaction",
							description:
								interaction.user.username + " " + action.text + " " + target.username +
								". The scene stays non-graphic; stop immediately if either person is uncomfortable.",
						}),
					],
					allowedMentions: { parse: [] },
				});
			},
		})),
	],
});
