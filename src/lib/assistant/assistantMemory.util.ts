import { z } from "zod";
import { MINUTE_MS } from "@config/constants";
import { type TestifyClient } from "@core/client";
import { toError } from "@core/errors";
import { fetchJson } from "@lib/infra";
import { listMemories } from "@database/repositories/aiMemoryRepository";
import { MEMORY_FORGET_PHRASES, MEMORY_LIMITS, MEMORY_SAVE_PHRASES } from "@lib/memory/memory.constants";
import { buildExtractionPrompt, judgeCandidate, parseExtraction, toMemoryCandidate } from "@lib/memory/memoryExtract.util";
import { forgetEverything, rememberCandidate, rememberExplicit } from "@lib/memory/memoryActions.util";
import { buildMemoryContext, entitiesOf, rankMemories } from "@lib/memory/memoryRetrieve.util";
import { hasStoppedTeasing, tonePreferenceOf } from "@lib/memory/memoryProfile.util";
import { type MemoryRecord, type RankedMemory, type AssistantTone } from "@lib/memory/memory.types";

/** How the assistant remembers, and how it is reminded. */

/** The chat endpoint every model comes through. */
const GROQ_CHAT_COMPLETIONS = "https://api.groq.com/openai/v1/chat/completions";
const EXTRACTION_TIMEOUT_MS = 20_000;
const EXTRACTION_MAX_TOKENS = 900;

const extractionResponseSchema = z.object({
	choices: z
		.array(
			z.object({
				finish_reason: z.string().nullable().optional(),
				message: z.object({ content: z.string().nullable().optional() }),
			}),
		)
		.min(1),
});

export interface ConversationTurn {
	role: "user" | "assistant";
	content: string;
}

/** Whether the person asked for something to be remembered, and what. */
export function explicitSaveOf(text: string): string | null {
	const lowered = text.toLowerCase();
	const phrase = MEMORY_SAVE_PHRASES.find((candidate) => lowered.includes(candidate));
	if (phrase === undefined) return null;

	const index = lowered.indexOf(phrase);
	const rest = text.slice(index + phrase.length).replace(/^[\s:,-]+/, "").trim();
	if (rest === "") return null;

	return rest;
}

/** Whether the person asked for something to be forgotten. */
export function explicitForgetOf(text: string): boolean {
	const lowered = text.toLowerCase();
	return MEMORY_FORGET_PHRASES.some((phrase) => lowered.includes(phrase));
}

export interface MemoryContext {
	/** Everything the bot knows about this person. */
	memories: MemoryRecord[];
	/** The memories that answer this question. */
	ranked: RankedMemory[];
	/** The block that goes into the prompt. */
	block: string;
	/** The tone this person has asked for. */
	tone: "roast" | "playful" | "neutral" | "professional" | null;
	/** They have asked not to be teased. */
	stoppedTeasing: boolean;
}

/**
 * What the bot should remember before it answers, and what it should be reminded of while answering.
 *
 * A failure to read the memory store is not a failure of the answer, so every error here falls back to
 * an empty context rather than stopping the conversation.
 */
export async function readMemoryContext(
	userId: string,
	guildId: string | null,
	question: string,
): Promise<MemoryContext> {
	const ranked = rankMemories(await listMemories(userId, guildId), question, { entities: entitiesOf(question) });
	const block = buildMemoryContext(await listMemories(userId, guildId), ranked);

	return {
		memories: await listMemories(userId, guildId),
		ranked,
		block,
		tone: tonePreferenceOf(await listMemories(userId, guildId)),
		stoppedTeasing: hasStoppedTeasing(await listMemories(userId, guildId)),
	};
}

/** The tone this person gets, once what they asked for is taken into account. */
export function toneFor(context: MemoryContext): AssistantTone {
	return context.tone === "roast" ? "tease" : "tease";
}

export interface ExtractionOutcome {
	/** How many memories were written. */
	stored: number;
	/** What happened to each candidate, for the operator's log. */
	kept: string[];
	/** Why the rest were not kept. */
	dropped: string[];
	/** Whether the model could not be reached. */
	failed: boolean;
}

/**
 * Reads a short exchange and works out what is worth remembering.
 *
 * The model proposes; the rules decide. Nothing is written because the model said so, and the rules
 * are the ones that throw away an imagined fact, a joke and an unverified guess.
 */
export async function extractMemories(input: {
	apiKey: string;
	model: string;
	userId: string;
	guildId: string | null;
	turns: readonly ConversationTurn[];
	sourceMessageId?: string | null;
	sourceChannelId?: string | null;
}): Promise<ExtractionOutcome> {
	const outcome: ExtractionOutcome = { stored: 0, kept: [], dropped: [], failed: false };

	const exchange = input.turns
		.slice(-6)
		.map((turn) => `${turn.role === "user" ? "Member" : "Zangetsu"}: ${turn.content}`)
		.join("\n");

	if (exchange.trim() === "") return outcome;

	try {
		const payload = await fetchJson("Groq AI", GROQ_CHAT_COMPLETIONS, extractionResponseSchema, {
			method: "POST",
			headers: {
				Authorization: "Bearer " + input.apiKey,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				model: input.model,
				temperature: 0.1,
				max_completion_tokens: EXTRACTION_MAX_TOKENS,
				reasoning_effort: "low",
				include_reasoning: false,
				messages: [
					{ role: "system", content: buildExtractionPrompt() },
					{ role: "user", content: `<exchange>\n${exchange.replace(/</g, "‹").replace(/>/g, "›")}\n</exchange>` },
				],
			}),
			timeoutMs: EXTRACTION_TIMEOUT_MS,
		});

		const content = payload.choices[0]?.message.content?.trim() ?? "";
		const candidates = parseExtraction(content).slice(0, MEMORY_LIMITS.maxCandidates);

		for (const candidate of candidates) {
			const judgement = judgeCandidate(candidate);
			if (!judgement.keep) {
				outcome.dropped.push(judgement.reason ?? "not worth keeping");
				continue;
			}

			const memory = toMemoryCandidate(candidate);
			const result = await rememberCandidate(memory, {
				userId: input.userId,
				guildId: input.guildId,
				sourceMessageId: input.sourceMessageId ?? null,
				sourceChannelId: input.sourceChannelId ?? null,
				recency: 1,
			});

			if (result.memory === null) {
				outcome.dropped.push("it could not be written");
				continue;
			}

			outcome.stored += 1;
			outcome.kept.push(`${result.outcome}: ${result.memory.summary}`);
		}

		return outcome;
	} catch (error) {
		outcome.failed = true;
		throw error;
	}
}

export interface ExtractionJob {
	userId: string;
	guildId: string | null;
	turns: ConversationTurn[];
	sourceMessageId: string | null;
	sourceChannelId: string | null;
}

const queue: ExtractionJob[] = [];
let scheduled = false;

/**
 * Puts an exchange in the queue to be read later.
 *
 * The queue exists so a member is never waiting for the model to think about what to remember.
 */
export function queueExtraction(client: TestifyClient, job: ExtractionJob): void {
	if (queue.length >= MEMORY_LIMITS.maxQueuedExtractions) queue.shift();
	queue.push(job);

	if (scheduled) return;
	scheduled = true;
	client.timers.after("memory-extraction", 50, () => {
		scheduled = false;
		void drainExtractions(client);
	});
}

/** Reads everything waiting, one at a time so the provider is not hit all at once. */
export async function drainExtractions(client: TestifyClient): Promise<void> {
	if (queue.length === 0) return;

	const apiKey = client.env.GROQ_API_KEY;
	if (apiKey === undefined || apiKey.trim() === "") {
		queue.length = 0;
		return;
	}

	while (queue.length > 0) {
		const job = queue.shift();
		if (job === undefined) break;

		try {
			const outcome = await extractMemories({
				apiKey,
				model: "openai/gpt-oss-20b",
				userId: job.userId,
				guildId: job.guildId,
				turns: job.turns,
				sourceMessageId: job.sourceMessageId,
				sourceChannelId: job.sourceChannelId,
			});

			client.logger.debug(
				{ userId: job.userId, stored: outcome.stored, kept: outcome.kept, dropped: outcome.dropped },
				"[MEMORY] What was remembered from a conversation.",
			);
		} catch (error) {
			// A memory that could not be written is a lost memory, not a broken bot.
			client.logger.warn({ err: toError(error), userId: job.userId }, "[MEMORY] A memory could not be written.");
		}
	}
}

/** How many extractions are waiting. */
export function pendingExtractions(): number {
	return queue.length;
}

/**
 * Stores something the member asked to be remembered, without asking a model.
 *
 * An explicit request is a fact in itself, so it does not need reading out of a conversation.
 */
export async function applyExplicitSave(
	content: string,
	userId: string,
	guildId: string | null,
): Promise<boolean> {
	const result = await rememberExplicit(content, { userId, guildId });
	return result.memory !== null;
}

/** Whether the member asked for everything to be forgotten. */
export async function applyExplicitForget(userId: string): Promise<boolean> {
	const removed = await forgetEverything(userId);
	return removed > 0;
}

/** How long the bot waits before it reads a conversation again. */
export const MEMORY_REFRESH_INTERVAL_MS = 5 * MINUTE_MS;
