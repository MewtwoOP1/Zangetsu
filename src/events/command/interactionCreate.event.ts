import { DiscordAPIError, Events, type Interaction, MessageFlags, RESTJSONErrorCodes } from "discord.js";
import { parseCustomId } from "@core/button";
import { runChecks } from "@core/checks";
import { runButton, runCommand, tell, toError } from "@core/errors";
import { defineEvent } from "@core/event";
import { countCommandUse, logCommandUse, recordCommandTime } from "@lib/bot";
import { errorEmbed, refusalEmbed } from "@lib/discord";

/** The only `interactionCreate` listener. */
export default defineEvent({
	name: Events.InteractionCreate,
	async run(client, interaction: Interaction) {
		if (interaction.isAutocomplete()) {
			const command = client.commands.get(interaction.commandName);
			if (!command?.autocomplete) return;

			try {
				await command.autocomplete(interaction, client);
			} catch (error) {
				const command = interaction.commandName;

				// Discord drops a keystroke's interaction when the next one arrives, so an answer crossing it is routine.
				if (error instanceof DiscordAPIError && error.code === RESTJSONErrorCodes.UnknownInteraction) {
					const ageMs = Date.now() - interaction.createdTimestamp;
					client.logger.trace({ command, ageMs }, "Autocomplete answered an interaction that had already expired");
				} else {
					client.logger.error({ err: toError(error), command }, "Autocomplete failed");
				}
			}
			return;
		}

		if (interaction.isChatInputCommand()) {
			const command = client.commands.get(interaction.commandName);
			if (!command) {
				client.logger.warn({ command: interaction.commandName }, "Unknown slash command");
				return;
			}

			// /play can spend several seconds in database-backed checks before yt-dlp even starts.
			// Acknowledge only this slow command up front; other commands and private subcommands keep their existing flow.
			if (command.name === "play") {
				try {
					await interaction.deferReply();
				} catch (error) {
					const ageMs = Date.now() - interaction.createdTimestamp;
					if (error instanceof DiscordAPIError && error.code === RESTJSONErrorCodes.UnknownInteraction) {
						client.logger.trace({ command: command.name, ageMs }, "Play interaction expired before acknowledgement");
					} else {
						client.logger.warn(
							{ err: toError(error), command: command.name, ageMs },
							"Could not acknowledge play interaction; skipping work",
						);
					}
					return;
				}
			}

			let refusal: Awaited<ReturnType<typeof runChecks>>;
			try {
				refusal = await runChecks(interaction, command, client);
			} catch (error) {
				// Do not strand /play's public deferred reply if a database check fails.
				if (command.name !== "play") throw error;

				client.logger.error({ err: toError(error), command: command.name }, "Play command checks failed");
				await tell(interaction, errorEmbed("I could not verify whether music can be played right now. Please try again."));
				return;
			}

			if (refusal !== null) {
				const refusalMessage = { embeds: [refusalEmbed(refusal)], flags: MessageFlags.Ephemeral } as const;

				if (interaction.deferred || interaction.replied) {
					// /play has a public deferred reply; remove its placeholder and keep refusals private.
					if (interaction.deferred && interaction.ephemeral !== true) {
						try {
							await interaction.deleteReply();
						} catch (error) {
							client.logger.debug({ err: toError(error), command: command.name }, "Could not remove deferred refusal placeholder");
						}
					}
					await interaction.followUp(refusalMessage);
				} else {
					await interaction.reply(refusalMessage);
				}
				return;
			}

			const started = Date.now();
			const ok = await runCommand(interaction, command, client);
			const durationMs = Date.now() - started;
			recordCommandTime(durationMs, ok);
			const run = { surface: "slash", ok, durationMs, channelId: interaction.channelId } as const;
			countCommandUse(client, interaction, command, run);
			logCommandUse(client, interaction, command, run);
			return;
		}

		if (!interaction.isMessageComponent() && !interaction.isModalSubmit()) return;

		const { id, action, args } = parseCustomId(interaction.customId);
		const button = client.buttons.get(id);
		if (!button) return;

		if (button.ownerOnly === true && args.at(-1) !== undefined && args.at(-1) !== interaction.user.id) {
			await interaction.reply({
				embeds: [errorEmbed("Only the person who ran the command can use these.")],
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		await runButton(interaction, () => button.run(interaction, { client, action, args }), client, id);
	},
});
