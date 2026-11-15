import { type Message } from "discord.js";
import { DEFAULT_PREFIX } from "@config/constants";
import { theme } from "@config/theme";
import { botName } from "@core/brand";
import { defineMessageHandler } from "@core/message";
import { parseMessage } from "@core/prefix";
import { getPrefix } from "@database/repositories/settingsRepository";
import {
	askZangetsu,
	chooseRomanticBoundary,
	formatAssistantReply,
	isRomanticAdvance,
	shouldUseBrowserSearch,
	splitAssistantReply,
	type AssistantTurn,
} from "@lib/assistant";
import { embed, linkButton, row } from "@lib/discord";
import { refreshZangetsuLive } from "@lib/knowledge";

/** Answers a mention with the Zangetsu app knowledge, as a reply to the message that asked. */

interface Conversation {
	history: AssistantTurn[];
	/** Every part of the last answer, so a reply to any of them continues the conversation. */
	assistantMessageIds: Set<string>;
	lastRomanticBoundary: string | null;
	expiresAt: number;
}

const CONVERSATION_TTL_MS = 20 * 60_000;
const USER_COOLDOWN_MS = 7_000;
/** The same person, asking in another channel, does not get to double the model's work. */
const USER_GLOBAL_COOLDOWN_MS = 20_000;
/** A channel full of mentions does not get an answer for every one of them. */
const CHANNEL_WINDOW_MS = 60_000;
const CHANNEL_MAX_ANSWERS = 6;
const MAX_CONVERSATIONS = 500;
const MAX_HISTORY_MESSAGES = 4;
const MAX_QUESTION_CHARS = 1_000;
/** How many message ids are remembered, so a repeated gateway event cannot answer twice. */
const MAX_PROCESSED_IDS = 1_000;

const conversations = new Map<string, Conversation>();
const cooldowns = new Map<string, number>();
const userCooldowns = new Map<string, number>();
const channelAnswers = new Map<string, number[]>();
const processed = new Set<string>();

function conversationKey(channelId: string, userId: string): string {
	return channelId + ":" + userId;
}

function pruneExpiredState(now: number): void {
	for (const [key, conversation] of conversations) {
		if (conversation.expiresAt <= now) conversations.delete(key);
	}
	for (const [key, expiresAt] of cooldowns) {
		if (expiresAt <= now) cooldowns.delete(key);
	}
	for (const [key, expiresAt] of userCooldowns) {
		if (expiresAt <= now) userCooldowns.delete(key);
	}
	for (const [key, answers] of channelAnswers) {
		const kept = answers.filter((at) => at > now - CHANNEL_WINDOW_MS);
		if (kept.length === 0) channelAnswers.delete(key);
		else channelAnswers.set(key, kept);
	}
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
		assistantMessageIds: new Set(),
		lastRomanticBoundary: null,
		expiresAt: now + CONVERSATION_TTL_MS,
	};
	conversations.set(key, created);
	return created;
}

/** Remove only this bot's mention, leaving every other mention untouched. */
export function stripAssistantMention(content: string, botId: string): string {
	return content.replace(new RegExp("<@!?" + botId + ">", "g"), "").trim();
}

/** Whether the message mentions this bot, by Discord's own mention list or by its raw form. */
export function mentionsBot(content: string, botId: string, mentioned: readonly string[] = []): boolean {
	if (mentioned.includes(botId)) return true;
	return new RegExp("<@!?" + botId + ">").test(content);
}

/** How many answers this channel has had inside the window. */
export function channelAnswerCount(channelId: string, now: number): number {
	return (channelAnswers.get(channelId) ?? []).filter((at) => at > now - CHANNEL_WINDOW_MS).length;
}

/** Tests can reset transient conversation state without importing Discord. */
export function clearMentionAssistantState(): void {
	conversations.clear();
	cooldowns.clear();
	userCooldowns.clear();
	channelAnswers.clear();
	processed.clear();
}

/** Remembers a message id, and says whether it had been seen before. */
function claimMessage(messageId: string): boolean {
	if (processed.has(messageId)) return false;
	processed.add(messageId);
	if (processed.size > MAX_PROCESSED_IDS) {
		const first = processed.values().next().value;
		if (first !== undefined) processed.delete(first);
	}
	return true;
}

/** The answer goes to the channel when the message itself can no longer be replied to. */
async function sendToChannel(
	channel: Message["channel"],
	payload: { content: string; allowedMentions: { users: string[] } },
): Promise<Message | null> {
	const candidate = channel as { send?: (body: unknown) => Promise<Message> };
	if (typeof candidate.send !== "function") return null;

	for (let attempt = 0; attempt < 2; attempt += 1) {
		try {
			return await candidate.send(payload);
		} catch {
			// A transient refusal gets one more try before the piece is given up on.
		}
	}

	return null;
}

export default defineMessageHandler({
	name: "mentionReply",
	order: 5,
	async run(message, client) {
		const botId = client.user?.id;
		const ownerId = client.env.DISCORD_OWNER_IDS[0];
		if (botId === undefined || ownerId === undefined || message.author.bot || !message.channel.isSendable()) return;

		const key = conversationKey(message.channelId, message.author.id);
		const now = Date.now();
		pruneExpiredState(now);

		const previous = conversations.get(key);
		const hasMention = mentionsBot(message.content, botId, [...message.mentions.users.keys()]);
		const isReplyToAssistant =
			previous !== undefined &&
			previous.expiresAt > now &&
			message.reference?.messageId !== undefined &&
			previous.assistantMessageIds.has(message.reference.messageId);

		if (!hasMention && !isReplyToAssistant) return;
		if (!claimMessage(message.id)) return true;

		const question = stripAssistantMention(message.content, botId);
		const prefix = message.guild === null ? DEFAULT_PREFIX : await getPrefix(message.guild.id);

		// Keep the existing natural-language recommendation flow and real prefix
		// commands. Those handlers use catalogue data and must not be replaced by chat.
		// Only check the mention-stripped question — not the full message with mention —
		// so that @zangetsu help me triggers AI chat rather than the prefix command handler.
		if (/^(?:suggest|recommend)\b/i.test(question)) return;
		const parsed = parseMessage(question, prefix, botId);
		if (parsed !== null) {
			const commandTarget = client.aliases.get(parsed.name) ?? parsed.name;
			const commandName = commandTarget.split(" ")[0] ?? commandTarget;
			if (client.commands.get(commandName) !== undefined) return;
		}

		// A bare mention keeps the existing compact introduction and help buttons.
		if (!question) {
			const buttons = [linkButton("Source code", theme.repository)];
			// The support server is optional, and an empty one is not a URL Discord will accept.
			if (theme.supportServer) buttons.push(linkButton("Support", theme.supportServer));
			const hint = "Mention me with a message to chat, or use /help or " + prefix + "help to see my commands.";
			await message.reply({
				content: hint,
				embeds: [
					embed({
						category: "info",
						title: "Hello, I am " + botName(),
						description: "My prefix here is " + prefix + ".\n\n" + hint,
						thumbnail: client.user?.displayAvatarURL(),
					}),
				],
				components: [row(...buttons)],
				allowedMentions: { parse: [] },
			});
			return true;
		}

		if (question.length > MAX_QUESTION_CHARS) {
			await message.reply({
				content: "That is a bit long for one message. Send the main point first and we can work through the rest.",
				allowedMentions: { parse: [] },
			});
			return true;
		}

		if (!client.env.GROQ_API_KEY) {
			await message.reply({
				content: "My Groq connection is not configured yet. The commands still work, though.",
				allowedMentions: { parse: [] },
			});
			return true;
		}

		const cooldownUntil = cooldowns.get(key) ?? 0;
		const userCooldownUntil = userCooldowns.get(message.author.id) ?? 0;
		if (cooldownUntil > now || userCooldownUntil > now) return true;
		if (channelAnswerCount(message.channelId, now) >= CHANNEL_MAX_ANSWERS) return true;
		// Removed inFlight check — each message is independently processed.
		// A previous in-flight request should not block unrelated messages.

		cooldowns.set(key, now + USER_COOLDOWN_MS);
		userCooldowns.set(message.author.id, now + USER_GLOBAL_COOLDOWN_MS);
		channelAnswers.set(message.channelId, [...(channelAnswers.get(message.channelId) ?? []), now]);

		const conversation = getConversation(key, now);
		try {
			await message.channel.sendTyping();

			// A question about the state of the world needs a current answer, so the release feed is
			// refreshed first — briefly, because somebody is waiting.
			if (shouldUseBrowserSearch(question)) {
				await refreshZangetsuLive({ timeoutMs: 3_000 });
			}

			const answer = await askZangetsu({
				question,
				history: conversation.history,
				ownerId,
				speakerId: message.author.id,
				apiKey: client.env.GROQ_API_KEY,
			});

			// Relationship boundaries are selected by the app, not generated as a
			// repeated sentence by the model. The category follows the member's message.
			const romanticAdvance = isRomanticAdvance(question, message.author.id, ownerId);
			const boundary = romanticAdvance ? chooseRomanticBoundary(question, conversation.lastRomanticBoundary) : null;
			const formattedAnswer = formatAssistantReply(answer, ownerId, boundary);
			const parts = splitAssistantReply(formattedAnswer);

			for (const [index, part] of parts.entries()) {
				const payload = {
					content: part,
					allowedMentions: { users: romanticAdvance ? [ownerId] : [] },
				};

				// The first piece answers the member's message; every later piece is an ordinary
				// channel message, so a long answer never becomes a chain of replies to itself.
				let sent: Message | null = null;
				if (index === 0) sent = await message.reply(payload).catch(() => null);
				sent ??= await sendToChannel(message.channel, payload);
				if (sent === null) {
					// The rest of the answer is still worth sending.
					client.logger.warn(
						{ channelId: message.channelId, piece: index + 1, pieces: parts.length },
						"[ASSISTANT] A piece of the answer could not be sent",
					);
					continue;
				}

				conversation.assistantMessageIds.add(sent.id);
			}

			if (boundary) conversation.lastRomanticBoundary = boundary;
			const historyAnswer = formattedAnswer.replace(new RegExp("<@!?" + ownerId + ">", "g"), "the owner");
			conversation.history.push({ role: "user", content: question }, { role: "assistant", content: historyAnswer });
			conversation.history = conversation.history.slice(-MAX_HISTORY_MESSAGES);
			conversation.expiresAt = Date.now() + CONVERSATION_TTL_MS;
		} catch (error) {
			client.logger.warn({ err: error }, "Zangetsu AI conversation failed");
			const fallback =
				error instanceof Error && error.message.startsWith("Groq returned no visible text")
					? "I got a little stuck thinking and lost my words. Try that again?"
					: "I couldn't reach my AI connection just now. Try again in a moment.";
			await message
				.reply({
					content: fallback,
					allowedMentions: { parse: [] },
				})
				.catch(() => sendToChannel(message.channel, { content: fallback, allowedMentions: { users: [] } }));
		}

		return true;
	},
});
