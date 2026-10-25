import { DEFAULT_PREFIX } from "@config/constants";
import { runChecks } from "@core/checks";
import { runCommand } from "@core/errors";
import { defineMessageHandler } from "@core/message";
import { parseMessage, PrefixInteraction } from "@core/prefix";
import { getPrefixConfig } from "@database/repositories/settingsRepository";
import { countCommandUse, logCommandUse, recordCommandTime } from "@lib/bot";
import { refusalEmbed, replyTemporarily } from "@lib/discord";

/** Lets natural-language recommendation requests reach intent parsing instead of positional type parsing. */
export function shouldDeferRecommendationToIntent(parsedName: string, args: string[]): boolean {
	return parsedName === "recommend" && !["anime", "movie", "series", "all"].includes(args[0] ?? "");
}

/** Runs `t?ban @someone` through the same code and checks as `/ban`. */
export default defineMessageHandler({
	name: "prefixCommands",
	order: 10,
	async run(message, client) {
		const botId = client.user?.id;
		if (botId === undefined) return;

		// A direct message has no server to have configured anything.
		const config =
			message.guild === null ? { prefix: DEFAULT_PREFIX, isEnabled: true } : await getPrefixConfig(message.guild.id);

		if (!config.isEnabled) return;

		const prefix = config.prefix;
		const parsed = parseMessage(message.content, prefix, botId);
		if (parsed === null) return;

		// Natural-language recommendation phrasing is not a positional type argument.
		// Explicit type-first calls (recommend anime|movie|series ...) still use the command handler.
		if (shouldDeferRecommendationToIntent(parsed.name, parsed.args)) return;

		// An alias can point at a subcommand, whose name goes back on the front of the arguments.
		const [name = parsed.name, subcommand] = (client.aliases.get(parsed.name) ?? parsed.name).split(" ");
		const args = subcommand === undefined ? parsed.args : [subcommand, ...parsed.args];

		const command = client.commands.get(name);
		if (!command) return;

		client.logger.debug({ command: command.name, user: message.author.id }, "Running a prefix command");

		const interaction = new PrefixInteraction(message, command, args);
		await interaction.options.prepare();

		const refusal = await runChecks(interaction, command, client);
		if (refusal !== null) {
			// A message cannot be private, so the refusal clears itself rather than staying in the channel.
			await replyTemporarily(client, message, refusalEmbed(refusal));
			return true;
		}

		const started = Date.now();
		const ok = await runCommand(interaction, command, client);
		const durationMs = Date.now() - started;
		recordCommandTime(durationMs, ok);
		const run = {
			surface: "prefix",
			ok,
			durationMs,
			channelId: message.guild === null ? null : message.channelId,
			prefix,
			typed: `${parsed.prefix ?? `@${client.user?.username ?? "mention"} `}${parsed.name}`,
		} as const;
		countCommandUse(client, interaction, command, run);
		logCommandUse(client, interaction, command, run);
		return true;
	},
});
