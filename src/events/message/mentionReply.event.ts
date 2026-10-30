import { DEFAULT_PREFIX } from "@config/constants";
import { theme } from "@config/theme";
import { botName } from "@core/brand";
import { parseMessage } from "@core/prefix";
import { defineMessageHandler } from "@core/message";
import { getPrefix } from "@database/repositories/settingsRepository";
import { askZangetsu, type AssistantTurn } from "@lib/assistant/zangetsuAssistant.util";
import { embed, linkButton, row } from "@lib/discord";

interface Conversation {
	history: AssistantTurn[];
	lastAssistantMessageId: string | null;
	expiresAt: number;
}

const CONVERSATION_TTL_MS = 20 * 60_000;
const USER_COOLDOWN_MS = 7_000;
const MAX_CONVERSATIONS = 500;
const MAX_HISTORY_MESSAGES = 10;

const conversations = new Map<string, Conversation>();
const cooldowns = new Map<string, number>();

function conversationKey(channelId: string, userId: string): string {
	return `${channelId}:${userId}`;
}

function getConversation(key: string, now: number): Conversation {
	const current = conversations.get(key);
	if (current !== undefined && current.expiresAt > now) {
		current.expiresAt = now + CONVERSATION_TTL_MS;
		return current;
	}

	if (conversations.size >= MAX_CONVERSATIONS) {
		const first = conversations.keys().next().value;
		if (first !== undefined) conversations.delete(first);
	}

	const created: Conversation = {
		history: [],
		lastAssistantMessageId: null,
		expiresAt: now + CONVERSATION_TTL_MS,
	};
	conversations.set(key, created);
	return created;
}

/** Remove only this bot's mention, leaving every other mention untouched. */
export function stripAssistantMention(content: string, botId: string): string {
	return content.replace(new RegExp(`<@!?${botId}>`, "g"), "").trim();
}

/** Tests can reset transient conversation state without importing Discord. */
export function clearMentionAssistantState(): void {
	conversations.clear();
	cooldowns.clear();
}

export default defineMessageHandler({
	name: "mentionReply",
	order: 5,
	async run(message, client) {
		const botId = client.user?.id;
		if (botId === undefined || message.author.bot || !message.channel.isSendable()) return;

		const key = conversationKey(message.channelId, message.author.id);
		const now = Date.now();
		const previous = conversations.get(key);
		const hasMention = message.mentions.users.has(botId) ||
			new RegExp(`<@!?${botId}>`).test(message.content);
		const isReplyToAssistant = previous !== undefined &&
			previous.expiresAt > now &&
			message.reference?.messageId === previous.lastAssistantMessageId;

		if (!hasMention && !isReplyToAssistant) return;

		const question = stripAssistantMention(message.content, botId);
		const prefix = message.guild === null ? DEFAULT_PREFIX : await getPrefix(message.guild.id);

		// Keep the existing natural-language recommendation flow and real prefix
		// commands. Those handlers use catalogue data and must not be replaced by chat.
		if (/^(?:suggest|recommend)\b/i.test(question)) return;
		const parsed = parseMessage(message.content, prefix, botId);
		if (parsed !== null) {
			const commandTarget = client.aliases.get(parsed.name) ?? parsed.name;
			const commandName = commandTarget.split(" ")[0] ?? commandTarget;
			const command = client.commands.get(commandName);
			if (
				command !== undefined &&
				(parsed.prefix !== null || parsed.args.length === 0 || (command.options?.length ?? 0) > 0)
			) {
				return;
			}
		}

		// A bare mention keeps the existing compact introduction and help buttons.
		if (!question) {
			await message.reply({
				embeds: [
					embed({
						category: "info",
						title: `Hello, I am ${botName()}`,
						description: `My prefix here is \`${prefix}\`.\n\nMention me with a message to chat, or use \`/help\` or \`${prefix}help\` to see my commands.`,
						thumbnail: client.user?.displayAvatarURL(),
					}),
				],
				components: [row(linkButton("Source code", theme.repository), linkButton("Support", theme.supportServer))],
				allowedMentions: { parse: [] },
			});
			return true;
		}

		if (question.length > 1_800) {
			await message.reply({
				content: "That is a bit long for one message. Send the main question first and we can work through the rest.",
				allowedMentions: { parse: [] },
			});
			return true;
		}

		if (!client.env.GROQ_API_KEY) {
			await message.reply({
				content: "I'd love to chat, but my Groq connection isn't configured on this bot yet. You can still use /help for commands and support.",
				allowedMentions: { parse: [] },
			});
			return true;
		}

		const cooldownUntil = cooldowns.get(key) ?? 0;
		if (cooldownUntil > now) return true;
		cooldowns.set(key, now + USER_COOLDOWN_MS);
		if (cooldowns.size > MAX_CONVERSATIONS) {
			const first = cooldowns.keys().next().value;
			if (first !== undefined) cooldowns.delete(first);
		}

		const conversation = getConversation(key, now);
		try {
			await message.channel.sendTyping();
			const answer = await askZangetsu({
				question,
				history: conversation.history,
				apiKey: client.env.GROQ_API_KEY,
				model: client.env.RECOMMENDATION_AI_MODEL,
			});
			const reply = await message.reply({
				content: answer,
				allowedMentions: { parse: [] },
			});

			conversation.history.push(
				{ role: "user", content: question },
				{ role: "assistant", content: answer },
			);
			conversation.history = conversation.history.slice(-MAX_HISTORY_MESSAGES);
			conversation.lastAssistantMessageId = reply.id;
			conversation.expiresAt = Date.now() + CONVERSATION_TTL_MS;
		} catch (error) {
			client.logger.warn({ err: error }, "Zangetsu AI conversation failed");
			await message.reply({
				content: "I lost my connection for a moment. Try mentioning me again in a little while.",
				allowedMentions: { parse: [] },
			});
		}

		return true;
	},
});
