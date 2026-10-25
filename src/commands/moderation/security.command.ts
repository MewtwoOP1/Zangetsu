import { PermissionFlagsBits } from "discord.js";
import { asMember, defineCommand, inGuild, inTextChannel, textChannelOption } from "@core/command";
import { UserFacingError } from "@core/errors";
import { PanicLock, RaidShieldConfig } from "@database/models/securityFeatures.schema";
import { embed, reply } from "@lib/discord";
import { channelExportCsv, MAX_CHANNEL_EXPORT_MESSAGES, permissionOverrideState } from "@lib/security";

export default defineCommand({
	name: "security",
	description: "Audit server permissions and run reversible safety tools.",
	category: "moderation",
	guildOnly: true,
	private: true,
	permissions: [PermissionFlagsBits.ManageGuild],
	subcommands: [
		{
			name: "admin-check",
			description: "Find roles with the Administrator permission.",
			async run(interaction) {
				const guild = inGuild(interaction);
				const roles = await guild.roles.fetch();
				const elevated = [...roles.values()].filter((role) => role.permissions.has(PermissionFlagsBits.Administrator));
				const details = elevated.slice(0, 25).map((role) => "- " + role.name.replace(/@/g, "@​") + " (" + role.id + ")");
				await reply(interaction, {
					embeds: [
						embed({
							category: "moderation",
							title: "Administrator role audit",
							description:
								"Found " +
								elevated.length +
								" role(s) with Administrator access. Review these roles and remove access that is no longer needed.\n\n" +
								(details.join("\n") || "No Administrator roles found."),
						}),
					],
					allowedMentions: { parse: [] },
				});
			},
		},
		{
			name: "audit-webhooks",
			description: "List server webhooks without revealing their tokens.",
			permissions: [PermissionFlagsBits.ManageWebhooks],
			async run(interaction) {
				const guild = inGuild(interaction);
				const webhooks = await guild.fetchWebhooks().catch(() => {
					throw new UserFacingError("I could not inspect webhooks. Make sure I have the Manage Webhooks permission.");
				});
				const lines = [...webhooks.values()].slice(0, 18).map((hook) => {
					const owner = hook.owner?.username ?? "unknown owner";
					const channel = hook.channelId ? "<#" + hook.channelId + ">" : "unknown channel";
					return "- " + hook.name + " — " + channel + " — owner: " + owner + " (" + (hook.owner?.id ?? "unknown") + ")";
				});
				await reply(interaction, {
					embeds: [
						embed({
							category: "moderation",
							title: "Webhook audit (" + webhooks.size + ")",
							description: lines.join("\n") || "No webhooks found.",
							footer: "Showing up to 18 webhooks. Webhook tokens are never displayed.",
						}),
					],
					allowedMentions: { parse: [] },
				});
			},
		},
		{
			name: "export-channel",
			description: "Export recent messages from a text channel to a private JSON or CSV file.",
			options: [
				{ name: "channel", description: "Text channel to export; defaults to this channel.", type: "channel" },
				{
					name: "format",
					description: "Export format.",
					type: "string",
					choices: [{ name: "CSV", value: "csv" }, { name: "JSON", value: "json" }],
				},
				{
					name: "limit",
					description: "Number of latest messages to include (1–100).",
					type: "integer",
					min: 1,
					max: MAX_CHANNEL_EXPORT_MESSAGES,
				},
			],
			async run(interaction) {
				if (interaction.tidyAway !== undefined) {
					throw new UserFacingError("Run this as a slash command so the exported file is delivered privately.");
				}

				const guild = inGuild(interaction);
				const channel = textChannelOption(interaction, "channel") ?? inTextChannel(interaction);
				const actorPermissions = channel.permissionsFor(asMember(interaction));
				if (
					!actorPermissions?.has(PermissionFlagsBits.ViewChannel) ||
					!actorPermissions.has(PermissionFlagsBits.ReadMessageHistory)
				) {
					throw new UserFacingError("You need View Channel and Read Message History permissions there to export messages.");
				}

				const me = guild.members.me;
				const botPermissions = me ? channel.permissionsFor(me) : null;
				if (
					!botPermissions?.has(PermissionFlagsBits.ViewChannel) ||
					!botPermissions.has(PermissionFlagsBits.ReadMessageHistory)
				) {
					throw new UserFacingError("I need View Channel and Read Message History permissions there to export messages.");
				}

				const limit = Math.min(MAX_CHANNEL_EXPORT_MESSAGES, Math.max(1, interaction.options.getInteger("limit") ?? 50));
				const format = interaction.options.getString("format") ?? "csv";
				const messages = await channel.messages.fetch({ limit });
				const rows = [...messages.values()]
					.sort((a, b) => a.createdTimestamp - b.createdTimestamp)
					.map((message) => ({
						createdAt: message.createdAt.toISOString(),
						author: message.author.username,
						authorId: message.author.id,
						content: message.content,
						attachments: [...message.attachments.values()].map((file) => file.url).join(" "),
					}));

				const filename = "zangetsu-channel-export-" + channel.id + "." + (format === "json" ? "json" : "csv");
				const content = format === "json" ? JSON.stringify(rows, null, 2) : channelExportCsv(rows);
				await reply(interaction, {
					content: "Exported " + rows.length + " messages from #" + channel.name + ". This file is visible only to you.",
					files: [{ attachment: Buffer.from(content, "utf8"), name: filename }],
					allowedMentions: { parse: [] },
				});
			},
		},
		{
			name: "panic",
			description: "Temporarily pause sending messages in this channel for @everyone.",
			permissions: [PermissionFlagsBits.ManageChannels],
			async run(interaction) {
				const guild = inGuild(interaction);
				const channel = inTextChannel(interaction);
				if (!("permissionOverwrites" in channel)) {
					throw new UserFacingError("Panic locks only work in channels with their own permission overwrites, not threads.");
				}

				const me = guild.members.me;
				if (!me || !me.permissionsIn(channel).has(PermissionFlagsBits.ManageRoles)) {
					throw new UserFacingError("I need Manage Roles permission in this channel to apply a panic lock.");
				}

				const existing = await PanicLock.findOne({ guildId: guild.id, channelId: channel.id }).lean().exec();
				if (existing) throw new UserFacingError("This channel is already panic-locked. Use /security restore here.");

				const everyone = guild.roles.everyone;
				const overwrite = channel.permissionOverwrites.cache.get(everyone.id);
				const sendMessages = permissionOverrideState(
					overwrite?.allow.bitfield ?? 0n,
					overwrite?.deny.bitfield ?? 0n,
					PermissionFlagsBits.SendMessages,
				);
				const sendMessagesInThreads = permissionOverrideState(
					overwrite?.allow.bitfield ?? 0n,
					overwrite?.deny.bitfield ?? 0n,
					PermissionFlagsBits.SendMessagesInThreads,
				);

				await PanicLock.create({
					guildId: guild.id,
					channelId: channel.id,
					sendMessages,
					sendMessagesInThreads,
					lockedBy: interaction.user.id,
				});

				try {
					await channel.permissionOverwrites.edit(
						everyone,
						{ SendMessages: false, SendMessagesInThreads: false },
						{ reason: "Emergency channel lockdown requested by " + interaction.user.username },
					);
				} catch (error) {
					await PanicLock.deleteOne({ guildId: guild.id, channelId: channel.id }).exec();
					throw error;
				}

				await reply(interaction, {
					embeds: [
						embed({
							category: "moderation",
							title: "Panic lock enabled",
							description:
								"Sending messages is disabled for @everyone in " +
								channel +
								". Use /security restore in the same channel to restore the previous Send Messages overrides.",
						}),
					],
					allowedMentions: { parse: [] },
				});
			},
		},
		{
			name: "restore",
			description: "Restore the Send Messages overrides saved by a panic lock.",
			permissions: [PermissionFlagsBits.ManageChannels],
			async run(interaction) {
				const guild = inGuild(interaction);
				const channel = inTextChannel(interaction);
				if (!("permissionOverwrites" in channel)) {
					throw new UserFacingError("Panic locks can only be restored from a channel with its own permission overwrites.");
				}

				const me = guild.members.me;
				if (!me || !me.permissionsIn(channel).has(PermissionFlagsBits.ManageRoles)) {
					throw new UserFacingError("I need Manage Roles permission in this channel to restore a panic lock.");
				}

				const record = await PanicLock.findOne({ guildId: guild.id, channelId: channel.id }).lean().exec();
				if (!record) throw new UserFacingError("There is no saved panic lock for this channel.");

				await channel.permissionOverwrites.edit(
					guild.roles.everyone,
					{ SendMessages: record.sendMessages, SendMessagesInThreads: record.sendMessagesInThreads },
					{ reason: "Restored panic-lock overrides by " + interaction.user.username },
				);
				await PanicLock.deleteOne({ guildId: guild.id, channelId: channel.id }).exec();

				await reply(interaction, {
					embeds: [
						embed({
							category: "moderation",
							title: "Panic lock restored",
							description: "The previous Send Messages overrides were restored in " + channel + ".",
						}),
					],
					allowedMentions: { parse: [] },
				});
			},
		},
		{
			name: "raid-shield-enable",
			description: "Enable join-burst alerts for this server.",
			options: [
				{ name: "alert-channel", description: "Where to send alerts; defaults to this channel.", type: "channel" },
				{ name: "threshold", description: "How many joins trigger an alert (3–50).", type: "integer", min: 3, max: 50 },
			],
			async run(interaction) {
				const guild = inGuild(interaction);
				const channel = textChannelOption(interaction, "alert-channel") ?? inTextChannel(interaction);
				const me = guild.members.me;
				const permissions = me ? channel.permissionsFor(me) : null;
				if (!permissions?.has(PermissionFlagsBits.ViewChannel) || !permissions.has(PermissionFlagsBits.SendMessages)) {
					throw new UserFacingError("I need View Channel and Send Messages in the alert channel.");
				}

				const threshold = Math.min(50, Math.max(3, interaction.options.getInteger("threshold") ?? 8));
				await RaidShieldConfig.findOneAndUpdate(
					{ guildId: guild.id },
					{
						$set: {
							enabled: true,
							threshold,
							windowSeconds: 30,
							alertChannelId: channel.id,
							updatedBy: interaction.user.id,
						},
					},
					{ upsert: true, new: true, setDefaultsOnInsert: true },
				).exec();

				await reply(interaction, {
					embeds: [
						embed({
							category: "moderation",
							title: "Raid Shield enabled",
							description:
								"I will alert " +
								channel +
								" when " +
								threshold +
								" or more joins occur within 30 seconds. No members are automatically kicked or banned.",
						}),
					],
				});
			},
		},
		{
			name: "raid-shield-disable",
			description: "Disable join-burst alerts for this server.",
			async run(interaction) {
				const guild = inGuild(interaction);
				await RaidShieldConfig.findOneAndUpdate(
					{ guildId: guild.id },
					{ $set: { enabled: false, updatedBy: interaction.user.id } },
					{ upsert: true, new: true, setDefaultsOnInsert: true },
				).exec();
				await reply(interaction, {
					embeds: [
						embed({
							category: "moderation",
							title: "Raid Shield disabled",
							description: "Join-burst alerts are now disabled.",
						}),
					],
				});
			},
		},
	],
});
