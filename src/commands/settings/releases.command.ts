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
import {
	fetchGitHubReleases,
	formatGitHubReleaseAnnouncement,
	parseGitHubRepository,
	type GitHubRelease,
} from "@lib/releases";

const MAX_TRACKED_REPOSITORIES = 10;
const DEFAULT_REPOSITORY = { owner: "spyou", repo: "zangetsu", fullName: "spyou/zangetsu", key: "spyou/zangetsu" };

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

				const selectedRole = role ? guild.roles.cache.get(role.id) : null;
				if (role && !selectedRole) throw new UserFacingError("I could not find that role in this server.");

				const botMember = guild.members.me;
				if (
					selectedRole &&
					!selectedRole.mentionable &&
					!botMember?.permissions.has(PermissionFlagsBits.MentionEveryone)
				) {
					throw new UserFacingError(
						"To ping this role, make it mentionable in Server Settings > Roles or grant me Mention Everyone permission.",
					);
				}
				if (
					botMember &&
					!channel.permissionsFor(botMember)?.has([
						PermissionFlagsBits.ViewChannel,
						PermissionFlagsBits.SendMessages,
					])
				) {
					throw new UserFacingError("I need View Channel and Send Messages in the selected channel.");
				}

				const existingSettings = await getReleaseAnnouncementSettings(guild.id);
				const defaultAlreadyTracked = existingSettings?.repositories.some(
					(tracked) =>
						tracked.owner.toLowerCase() === DEFAULT_REPOSITORY.owner &&
						tracked.repo.toLowerCase() === DEFAULT_REPOSITORY.repo,
				) ?? false;

				let latestDefaultRelease: GitHubRelease | null = null;
				if (!defaultAlreadyTracked) {
					if ((existingSettings?.repositories.length ?? 0) >= MAX_TRACKED_REPOSITORIES) {
						throw new UserFacingError(
							`This server already tracks ${String(MAX_TRACKED_REPOSITORIES)} repositories. Remove one before setting up the default Spyou/Zangetsu feed.`,
						);
					}
					try {
						const releases = await fetchGitHubReleases(DEFAULT_REPOSITORY);
						latestDefaultRelease =
							[...releases].sort(
								(left, right) => Date.parse(right.published_at ?? "") - Date.parse(left.published_at ?? ""),
							)[0] ?? null;
					} catch (error) {
						throw new UserFacingError(
							`Could not initialize the default Spyou/Zangetsu release feed: ${error instanceof Error ? error.message : "GitHub could not be reached."}`,
						);
					}
				}

				await setReleaseAnnouncementTarget(guild.id, channel.id, role?.id ?? null);
				if (!defaultAlreadyTracked) {
					await addTrackedGitHubRepository(guild.id, {
						owner: DEFAULT_REPOSITORY.owner,
						repo: DEFAULT_REPOSITORY.repo,
						lastReleaseId: latestDefaultRelease?.id ?? null,
						lastReleasePublishedAt: latestDefaultRelease?.published_at ?? null,
					});
				}
				const pingStatus = role === null ? "Role pings are disabled." : `The <@&${role.id}> role will be pinged.`;
				await reply(interaction, {
					embeds: [
						successEmbed(
							`Release announcements will be posted in <#${channel.id}>. Spyou/Zangetsu is tracked by default. ${pingStatus}`,
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

				let releases: GitHubRelease[];
				try {
					releases = await fetchGitHubReleases(repository, { forceRefresh: true });
				} catch (error) {
					throw new UserFacingError(error instanceof Error ? error.message : "GitHub could not be reached.");
				}

				const latest =
					[...releases].sort(
						(left, right) => Date.parse(right.published_at ?? "") - Date.parse(left.published_at ?? ""),
					)[0] ?? null;
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
								? `Tracking \`${repository.fullName}\`. Future releases will be announced.`
								: `Tracking \`${repository.fullName}\`. The first published release will be announced.`,
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
								`**Repositories (${String(settings.repositories.length)}/${String(MAX_TRACKED_REPOSITORIES)}):**`,
								repositories,
							].join("\n"),
						}),
					],
				});
			},
		},
		{
			name: "test",
			description: "Preview the latest app release using the official plain-text announcement format.",
			async run(interaction, client) {
				const guild = inGuild(interaction);
				const settings = await getReleaseAnnouncementSettings(guild.id);
				if (!settings) {
					throw new UserFacingError("Release announcements are not set up. Run `/releases setup` first.");
				}

				const channel = await client.channels.fetch(settings.channelId).catch(() => null);
				if (
					!channel?.isTextBased() ||
					!channel.isSendable() ||
					!("guildId" in channel) ||
					channel.guildId !== guild.id
				) {
					throw new UserFacingError(
						"The configured release channel is unavailable. Run `/releases setup` again with a writable text channel.",
					);
				}

				let releases: GitHubRelease[];
				try {
					releases = await fetchGitHubReleases(DEFAULT_REPOSITORY, { forceRefresh: true });
				} catch (error) {
					throw new UserFacingError(
						`Could not fetch the latest Spyou/Zangetsu app release: ${error instanceof Error ? error.message : "GitHub could not be reached."}`,
					);
				}

				const latestRelease =
					[...releases].sort(
						(left, right) => Date.parse(right.published_at ?? "") - Date.parse(left.published_at ?? ""),
					)[0] ?? null;
				if (!latestRelease) {
					throw new UserFacingError(
						"No published releases were found for Spyou/Zangetsu, so I cannot create a version-specific test announcement yet.",
					);
				}

				const announcement = formatGitHubReleaseAnnouncement(DEFAULT_REPOSITORY, latestRelease);
				await channel.send({
					content: settings.roleId === null ? announcement : `<@&${settings.roleId}>\n${announcement}`,
					allowedMentions: { parse: [], roles: settings.roleId === null ? [] : [settings.roleId] },
				});

				await reply(interaction, {
					content: `Test announcement sent to <#${settings.channelId}>.`,
				});
			},
		},
	],
});
