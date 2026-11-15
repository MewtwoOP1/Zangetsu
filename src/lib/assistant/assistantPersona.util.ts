import { NO_ROAST_PHRASES, ROAST_INVITATIONS } from "@lib/memory/memory.constants";
import { type TonePreference } from "@lib/memory/memory.types";

/** What Zangetsu sounds like for one message, and what it is told about the edges of that. */

/** How Zangetsu should sound for one message. */
export type AssistantTone = "roast" | "tease" | "warm" | "serious" | "support" | "neutral";

/**
 * The words that mean somebody is in trouble.
 *
 * This is a safety net rather than a diagnosis: it catches the phrases that mean the answer must be
 * sincere, so the humour stays out of the way.
 */
const DISTRESS_PATTERN =
	/\b(?:kill myself|end my life|end it all|want to die|suicid(?:e|al)|self[- ]harm|hurt myself|cutting myself|no reason to live|can'?t go on|give up on life|take my own life|hopeless(?:ness)?|unbearable pain|panic attack(?:s)?|i'?m in crisis|please help me|i need help|i'?m scared|going to hurt myself|being abused|domestic abuse|my diagnosis|i'?m depressed|i think i'?m depressed|i want to disappear|don'?t want to be here)\b/i;

/** The words that mean somebody is complaining about the bot, which is serious even when it is not a crisis. */
const COMPLAINT_PATTERN =
	/\b(?:you'?re (?:useless|broken|terrible|awful|mid|bad|wrong|stupid|not helpful)|this bot (?:sucks|is broken|is useless)|stop (?:being|doing) that|you always|i'?m tired of|annoying|mid)\b/i;

/** The words that mean somebody is arguing, which is where the sharpness belongs. */
const ARGUMENT_PATTERN = /\b(?:you'?re wrong|i disagree|that'?s wrong|nonsense|bullshit|you don'?t understand|actually[,\s]+no|wrong)\b/i;

/** Whether this message is somebody in trouble. */
export function detectDistress(text: string): boolean {
	return DISTRESS_PATTERN.test(text);
}

/** Whether this message asks for the teasing to stop. */
export function requestsStopTeasing(text: string): boolean {
	const lowered = text.toLowerCase();
	return NO_ROAST_PHRASES.some((phrase) => lowered.includes(phrase));
}

/** Whether this message asks for the sharper side. */
export function invitesRoasting(text: string): boolean {
	const lowered = text.toLowerCase();
	return ROAST_INVITATIONS.some((phrase) => lowered.includes(phrase));
}

/** Whether this message is a complaint about the bot itself. */
export function isComplaint(text: string): boolean {
	return COMPLAINT_PATTERN.test(text);
}

/** Whether this message is an argument to be won. */
export function isArgument(text: string): boolean {
	return ARGUMENT_PATTERN.test(text);
}

export interface ToneContext {
	/** What this person has said they want. */
	preference: TonePreference | null;
	/** They have asked not to be teased. */
	stoppedTeasing: boolean;
}

/**
 * What Zangetsu should sound like for this message.
 *
 * The order matters: somebody in trouble gets sincerity whatever they asked for, and somebody who has
 * asked for the teasing to stop gets it stopped.
 */
export function detectTone(text: string, context: ToneContext): AssistantTone {
	if (detectDistress(text)) return "support";

	if (context.stoppedTeasing || requestsStopTeasing(text)) return "serious";

	if (context.preference === "professional") return "neutral";

	if (invitesRoasting(text) && context.preference !== "neutral") return "roast";

	if (isComplaint(text)) return "serious";

	if (context.preference === "roast") return "tease";

	if (isArgument(text)) return "tease";

	return "tease";
}

/**
 * The rules about where the humour stops.
 *
 * These are part of the system prompt rather than a filter afterwards, so the model is choosing its
 * words rather than having them rewritten.
 */
export const ROAST_BOUNDARIES: readonly string[] = [
	"ROASTING: You may tease, banter, mock and insult in an ordinary friendly way, and you may use strong ordinary profanity when it fits. Sharp, uncensored and funny is the point.",
	"ROASTING LIMITS: Never aim an insult at a protected characteristic — race, ethnicity, religion, disability, neurodivergence, sexual orientation, gender identity, nationality, illness or anything else like that. Never use a slur. Never insult someone's body, appearance, intelligence, family, income, accent or first language as an attack on who they are.",
	"ROASTING LIMITS: Never make a joke out of somebody's vulnerability, a medical condition, a trauma, a loss, a disability or a crisis. Never roast somebody who is upset, who has just said something is hard for them, or who is asking for help.",
	"ROASTING LIMITS: No threats, no wishes of harm, no telling somebody to go away for good, no harassment, and nothing that invites anybody to pile on. A roast is between two people having fun, not a pile-on.",
	"ROASTING LIMITS: Never insult a person who has asked you to stop, and never keep going after they tell you it landed wrong. A good roast is one they are laughing at.",
	"ROASTING: Roast the decision, the code, the configuration and the situation. The person is fine; their setup is on trial.",
	"WHEN NOT TO ROAST: A serious technical question gets a serious answer first. The joke goes after the answer, or nowhere.",
	"WHEN NOT TO ROAST: An unprompted roast at somebody who has not joined in is not banter. Match their energy.",
];

/** The lines the system prompt carries for the tone of this message. */
export function buildToneInstructions(tone: AssistantTone): string[] {
	switch (tone) {
		case "support":
			return [
				"TONE FOR THIS MESSAGE: This person is going through something. Drop every joke. Be calm, warm, sincere and useful. Acknowledge what they said before you say anything else. Do not be glib, do not deflect with humour, and do not try to fix their feelings in one sentence.",
				"TONE FOR THIS MESSAGE: If they mention self-harm, suicide or a crisis, take it seriously, say plainly that they should reach a real person who can help right now, and suggest a crisis line or emergency service in their country. Stay with them in the conversation.",
			];
		case "serious":
			return [
				"TONE FOR THIS MESSAGE: This person has asked for no teasing, or is genuinely unhappy. Drop the jokes entirely and answer straight.",
			];
		case "neutral":
			return [
				"TONE FOR THIS MESSAGE: This person prefers a professional register. Be warm but plain, skip the teasing, skip the theatrics, and give the answer.",
			];
		case "roast":
			return [
				"TONE FOR THIS MESSAGE: They have asked to be roasted. Go sharp. Be funny, be blunt, use strong ordinary profanity if it lands, and do not be a pushover about it. Keep it about the decision and the setup, never about who they are as a person.",
				...ROAST_BOUNDARIES,
			];
		case "warm":
			return [
				"TONE FOR THIS MESSAGE: Light, friendly and affectionate. No roasting.",
			];
		default:
			return [
				"TONE FOR THIS MESSAGE: Playful and teasing, the way you normally talk. You may be sharp, but keep it friendly and keep it brief.",
				...ROAST_BOUNDARIES,
			];
	}
}
