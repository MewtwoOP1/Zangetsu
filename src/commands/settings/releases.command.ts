import { PermissionFlagsBits } from "discord.js";
import { defineCommand, inGuild } from "@core/command";
import { UserFacingError } from "@core/errors";
import {
	addTrackedGitHubRepository,
	getReleaseAnnouncementSettings,
	removeTrackedGitHubRepository,
	setReleaseAnnouncementTarget,
} from "@database/repositories/releaseAnnouncementRepository";
import { embed, reply, successEmbed } from "@lib/discord";
import { fetchGitHubReleases, parseGitHubRepository } from "@lib/releases";

const MAX_TRACKED_REPOSITORIES = 10;

export default defineCommand({
	name: "releases",
	description: "Configure GitHub release announcements for this server.",
	category: "settings",
	guildOnly: true,
	private: true,
	permissions: [PermissionFlagsBits.ManageGuild],
	botPermissions: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks],
	subcommands: [
		{
			name: "setup",
			description: "Choose where release announcements are posted and which role is pinged.",
			options: [
				{ name: "channel", description: "Channel for release announcements.", type: "channel", required: true },
				{ name: "role", description: "Role to ping for new releases. Omit to disable role pings.", type: "role" },
			],
			async run(interaction) {
				const guild = inGuild(interaction);
				const selected = interaction.options.getChannel("channel", true);
				const channel = guild.channels.cache.get(selected.id);
				if (!channel?.isTextBased() || !channel.isSendable()) {
					throw new UserFacingError("Choose a text channel where I can send messages.");
				}

				const role = interaction.options.getRole("role");
				if (role?.id === guild.id) {
					throw new UserFacingError("The @everyone role cannot be used for release announcements.");
				}

				const botMember = guild.members.me;
				if (
					botMember &&
					!channel.permissionsFor(botMember)?.has([
						PermissionFlagsBits.ViewChannel,
						PermissionFlagsBits.SendMessages,
						PermissionFlagsBits.EmbedLinks,
					])
				) {
					throw new UserFacingError("I need View Channel, Send Messages, and Embed Links in the selected channel.");
				}

				await setReleaseAnnouncementTarget(guild.id, channel.id, role?.id ?? null);
				await reply(interaction, {
					embeds: [
						successEmbed(
							`Release announcements will be posted in <#${channel.id}>. ${role ? `The <@&${role.id}> role will be pinged.` : "Role pings are disabled."}`,
						),
					],
				});
			},
		},
		{
			name: "add",
			description: "Track a public GitHub repository's published releases.",
			options: [
				{
					name: "repository",
					description: "GitHub owner/repo or the repository URL.",
					type: "string",
					required: true,
					maxLength: 200,
				},
			],
			async run(interaction) {
				const guild = inGuild(interaction);
				const settings = await getReleaseAnnouncementSettings(guild.id);
				if (!settings) throw new UserFacingError("Run `/releases setup` first to choose an announcement channel.");

				const input = interaction.options.getString("repository", true);
				const repository = parseGitHubRepository(input);
				if (!repository) {
					throw new UserFacingError("Enter a public GitHub repository as `owner/repo` or `https://github.com/owner/repo`.");
				}

				if (
					settings.repositories.some(
						(tracked) => tracked.owner.toLowerCase() === repository.owner && tracked.repo.toLowerCase() === repository.repo,
					)
				) {
					throw new UserFacingError(`\`${repository.fullName}\` is already being tracked.`);
				}
				if (settings.repositories.length >= MAX_TRACKED_REPOSITORIES) {
					throw new UserFacingError(`This server can track up to ${String(MAX_TRACKED_REPOSITORIES)} repositories.`);
				}

				let releases;
				try {
					releases = await fetchGitHubReleases(repository, { forceRefresh: true });
				} catch (error) {
					throw new UserFacingError(error instanceof Error ? error.message : "GitHub could not be reached.");
				}

				const latest = releases[0] ?? null;
				const added = await addTrackedGitHubRepository(guild.id, {
					owner: repository.owner,
					repo: repository.repo,
					lastReleaseId: latest?.id ?? null,
					lastReleasePublishedAt: latest?.published_at ?? null,
				});
				if (!added) throw new UserFacingError(`\`${repository.fullName}\` is already being tracked.`);

				await reply(interaction, {
					embeds: [
						successEmbed(
							latest
								? `Now tracking \`${repository.fullName}\`. Newer releases will be announced; the current release was saved as the starting point.`
								: `Now tracking \`${repository.fullName}\`. No published releases were found, so the first published release will be announced.`,
						),
					],
				});
			},
		},
		{
			name: "remove",
			description: "Stop tracking a GitHub repository.",
			options: [
				{
					name: "repository",
					description: "GitHub owner/repo or the repository URL.",
					type: "string",
					required: true,
					maxLength: 200,
				},
			],
			async run(interaction) {
				const guild = inGuild(interaction);
				const repository = parseGitHubRepository(interaction.options.getString("repository", true));
				if (!repository) {
					throw new UserFacingError("Enter a GitHub repository as `owner/repo` or `https://github.com/owner/repo`.");
				}

				const removed = await removeTrackedGitHubRepository(guild.id, repository.owner, repository.repo);
				if (!removed) throw new UserFacingError(`\`${repository.fullName}\` is not being tracked.`);

				await reply(interaction, { embeds: [successEmbed(`Stopped tracking \`${repository.fullName}\`.`)] });
			},
		},
		{
			name: "list",
			description: "Show the configured channel, ping role, and tracked repositories.",
			async run(interaction) {
				const guild = inGuild(interaction);
				const settings = await getReleaseAnnouncementSettings(guild.id);
				if (!settings) {
					throw new UserFacingError("Release announcements are not set up. Run `/releases setup` first.");
				}

				const repositories = settings.repositories.length
					? settings.repositories.map((tracked) => `• \`${tracked.owner}/${tracked.repo}\``).join("\n")
					: "No repositories are being tracked yet. Use `/releases add`.";
				await reply(interaction, {
					embeds: [
						embed({
							category: "info",
							title: "GitHub release announcements",
							description: [
								`**Channel:** <#${settings.channelId}>`,
								`**Ping role:** ${settings.roleId ? `<@&${settings.roleId}>` : "Disabled"}`,
								`**Check interval:** Every 10 minutes`,
								"",
								`**Repositories (${String(settings.repositories.length)}/${String(MAX_TRACKED_REPOSITORIES)):**`,
								repositories,
							].join("\n"),
						}),
					],
				});
			},
		},
		{
			name: "test",
			description: "Send a test announcement to verify the channel, embed, and role ping.",
			async run(interaction, client) {
				const guild = inGuild(interaction);
				const settings = await getReleaseAnnouncementSettings(guild.id);
				if (!settings) {
					throw new UserFacingError("Release announcements are not set up. Run `/releases setup` first.");
				}

				const channel = await client.channels.fetch(settings.channelId).catch(() => null);
				if (!channel?.isTextBased() || !channel.isSendable()) {
					throw new UserFacingError("I cannot send messages in the configured announcement channel. Run `/releases setup` with a channel I can access.");
				}

				await channel.send({
					...(settings.roleId === null ? {} : { content: `<@&${settings.roleId}>` }),
					embeds: [
						embed({
							category: "info",
							title: "GitHub release announcements test",
							description:
								"This is a test message from Zangetsu. The announcement channel and embed are working. " +
								"Future announcements will include the release version, repository, publication date, and release notes.",
							url: "https://github.com/MewtwoOP1/Zangetsu/releases",
							footer: "Test announcement · no release was published",
						}),
					],
					allowedMentions: { parse: [], roles: settings.roleId === null ? [] : [settings.roleId] },
				});

				await reply(interaction, {
					embeds: [successEmbed(`Test announcement sent to <#${settings.channelId}>.`)],
				});
			},
		},
	],
});
