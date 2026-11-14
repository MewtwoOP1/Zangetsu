import { stem } from "@testify/shared";
import { KNOWLEDGE_LIMITS } from "@lib/knowledge/knowledge.constants";
import { type KnowledgeEntry, type KnowledgeHit, type KnowledgePlatform, type KnowledgeTopic } from "@lib/knowledge/knowledge.types";

/** Finds the Zangetsu knowledge that answers a member's question, and reads what the question is about. */

const STOP_WORDS = new Set(
	(
		"a about after all also am an and any are as at be been being but by can cant could did do does doing dont for from " +
		"get got had has have how i if im in into is it its just me my no not of on once only or our out over please she " +
		"should so some than that the their them then there these they this those to too up us use used was we were what " +
		"when where which while who why will with would you your"
	).split(" "),
);

/** Words a member uses for something the guide calls by another name. */
const ALSO_MEANS: Record<string, string[]> = {
	firestick: ["tv", "android"],
	shield: ["tv", "android"],
	chromecast: ["cast"],
	roku: ["cast"],
	sideload: ["install"],
	adb: ["install"],
	apk: ["install", "download"],
	blank: ["empty"],
	empty: ["blank"],
	frozen: ["buffering", "stall"],
	stuck: ["buffering", "stall"],
	slow: ["buffering"],
	error: ["problem", "fails"],
	broken: ["problem", "fails"],
	fails: ["problem", "error"],
	failing: ["problem", "error"],
	sub: ["subtitle"],
	subs: ["subtitle"],
	captions: ["subtitle"],
	trackers: ["anilist", "mal", "simkl"],
	anime: [],
};

const TOPIC_HINTS: Array<[KnowledgeTopic, RegExp]> = [
	[
		"install",
		/\b(?:install|installation|apk|download|sideload|update|updates|version|build|architecture|arm64|armeabi|universal|crash|crashes|installing)\b/i,
	],
	[
		"sources",
		/\b(?:source|sources|repository|repositories|repo|extension|extensions|provider|providers|ecosystem|cs3|cloudstream|aniyomi|mihon|lnreader|catalogue|catalog)\b/i,
	],
	[
		"reading",
		/\b(?:manga|webtoon|manhwa|manhua|novel|novels|light novel|chapter|chapters|reader|reading|epub)\b/i,
	],
	[
		"accounts",
		/\b(?:account|accounts|profile|profiles|anilist|myanimelist|mal|simkl|discord rich presence|incognito|qr|sign in|sync|queue)\b/i,
	],
	[
		"tv",
		/\b(?:tv|android tv|fire tv|roku|remote|d-?pad|chromecast|big screen)\b/i,
	],
	[
		"library",
		/\b(?:home screen|continue watching|watch history|history|browse|catalogue|catalog|search|auto resolve|metadata)\b/i,
	],
	[
		"settings",
		/\b(?:settings|setting|preference|preferences|toggle|language|appearance|display|storage|permission|permissions|buffer size)\b/i,
	],
	[
		"updates",
		/\b(?:update|updates|release|releases|version|versions|changelog|beta|stable|new version|latest)\b/i,
	],
	[
		"playback",
		/\b(?:play|playback|buffer|buffering|stream|streams|server|servers|quality|resolution|cast|chromecast|external player|subtitle|subtitles|episode|episodes|download|downloads|offline)\b/i,
	],
];

/** Questions whose answer changes with the world rather than with the guide. */
const CURRENT_PATTERNS = [
	/\b(?:is|are)\s+(?:zangetsu|the app|the site|zangetsu\.online)\s+(?:down|offline|out|broken)\b/i,
	/\b(?:site|service|server|api|github|provider)\s+(?:down|offline|out)\b/i,
	/\b(?:latest|newest|current|most recent)\s+(?:version|release|update)\b/i,
	/\b(?:is|are)\s+(?:there|any)\s+(?:a\s+)?(?:new|any)\s+(?:update|release|version)\b/i,
	/\b(?:have|has)\s+(?:this|it|the bug|that)\s+(?:been\s+)?(?:been\s+)?fixed\b/i,
	/\b(?:is|was)\s+(?:this|that|it)\s+(?:fixed|resolved|solved)\b/i,
	/\b(?:still|not)\s+(?:happening|broken|fixed)\b/i,
	/\b(?:is|are)\s+(?:the\s+)?(?:sources?|extensions?|providers?)\s+(?:dead|down|broken|expired)\b/i,
	/\b(?:what|which)\s+(?:is|are)\s+(?:the\s+)?(?:current|latest)\b/i,
	/\b(?:right now|as of now|at the moment|these days)\b/i,
	/\b(?:official|current|latest)\s+(?:installation|install|procedure|steps)\b/i,
	/\b(?:has|have)\s+(?:it|this|the issue|the bug)\s+been\s+(?:resolved|fixed|reported)\b/i,
	/\b(?:new|recent|latest)\s+(?:release|releases|version|versions|update|updates)\b/i,
];

function normalise(text: string): string {
	return text
		.normalize("NFKD")
		.replace(/\p{M}/gu, "")
		.toLowerCase()
		.replace(/['’]/g, "")
		.replace(/[^a-z0-9]+/g, " ")
		.trim();
}

function tokensOf(text: string): string[] {
	return normalise(text)
		.split(" ")
		.filter((word) => word.length > 1 && !STOP_WORDS.has(word))
		.map((word) => stem(word));
}

/** Expands a word with the words the guide uses for it. */
function alternatives(word: string): string[] {
	return [...new Set([word, ...(ALSO_MEANS[word] ?? [])].map((candidate) => stem(candidate)))];
}

export function detectPlatform(text: string): KnowledgePlatform {
	if (/\b(?:android tv|google tv|fire tv|firestick|shield tv|apple tv|streaming box|smart tv|d-?pad)\b/i.test(text)) {
		return "android-tv";
	}
	if (/\b(?:iphone|ipad|ios|testflight)\b/i.test(text)) return "ios";
	if (/\b(?:android|phone|tablet|apk|side-?load)\b/i.test(text)) return "android";
	return "any";
}

export function detectTopic(text: string): KnowledgeTopic | null {
	for (const [topic, pattern] of TOPIC_HINTS) {
		if (pattern.test(text)) return topic;
	}
	return null;
}

export function asksForCurrentInformation(text: string): boolean {
	return CURRENT_PATTERNS.some((pattern) => pattern.test(text));
}

/** The error text in the question, matched against the errors the corpus explains. */
export function detectError(question: string, entries: readonly KnowledgeEntry[]): string | null {
	const haystack = normalise(question);
	let found: string | null = null;

	for (const entry of entries) {
		for (const error of entry.errorStrings) {
			const needle = normalise(error);
			if (needle.length < 6 || !haystack.includes(needle)) continue;
			if (found === null || error.length > found.length) found = error;
		}
	}

	return found;
}

interface Indexed {
	entry: KnowledgeEntry;
	counts: Map<string, number>;
	length: number;
	questions: string[];
}

const FIELD_WEIGHTS = { title: 3, questions: 3, keywords: 2, body: 1 } as const;
const K1 = 1.2;
const B = 0.75;
/** An exact error string is the strongest evidence there is. */
const ERROR_BONUS = 60;
/** The member asked almost exactly the question the entry answers. */
const QUESTION_BONUS = 18;
/** Every word of the title is in the question. */
const TITLE_BONUS = 8;
/** Below this the entry is about something else. */
const MIN_COVERAGE = 0.2;

class KnowledgeIndex {
	readonly #documents: Indexed[] = [];
	readonly #frequency = new Map<string, number>();
	readonly #averageLength: number;

	constructor(entries: readonly KnowledgeEntry[]) {
		for (const entry of entries) {
			const counts = new Map<string, number>();
			let length = 0;
			const add = (text: string, weight: number): void => {
				for (const token of tokensOf(text)) {
					counts.set(token, (counts.get(token) ?? 0) + weight);
					length += weight;
				}
			};

			add(entry.title, FIELD_WEIGHTS.title);
			for (const question of entry.questions) add(question, FIELD_WEIGHTS.questions);
			add(entry.keywords.join(" "), FIELD_WEIGHTS.keywords);
			add(entry.body, FIELD_WEIGHTS.body);

			this.#documents.push({ entry, counts, length, questions: entry.questions.map(normalise) });
		}

		for (const document of this.#documents) {
			for (const token of document.counts.keys()) {
				this.#frequency.set(token, (this.#frequency.get(token) ?? 0) + 1);
			}
		}

		const total = this.#documents.reduce((sum, document) => sum + document.length, 0);
		this.#averageLength = this.#documents.length === 0 ? 1 : total / this.#documents.length;
	}

	#idf(token: string): number {
		const count = this.#documents.length;
		const holding = this.#frequency.get(token) ?? 0;
		return Math.log(1 + (count - holding + 0.5) / (holding + 0.5));
	}

	#bm25(document: Indexed, term: string): number {
		const frequency = document.counts.get(term) ?? 0;
		if (frequency === 0) return 0;
		const norm = K1 * (1 - B + (B * document.length) / this.#averageLength);
		return (this.#idf(term) * (frequency * (K1 + 1))) / (frequency + norm);
	}

	search(question: string): KnowledgeHit[] {
		const words = tokensOf(question);
		if (words.length === 0) return [];

		const haystack = normalise(question);
		const hits: KnowledgeHit[] = [];

		for (const document of this.#documents) {
			let score = 0;
			let matched = 0;
			let importance = 0;

			for (const word of words) {
				const options = alternatives(word);
				let best = 0;
				for (const option of options) {
					const value = this.#bm25(document, option);
					if (value > best) best = value;
				}
				const weight = Math.max(...options.map((option) => this.#idf(option)));
				importance += weight;
				if (best > 0) {
					score += best;
					matched += weight;
				}
			}

			const coverage = importance === 0 ? 0 : Math.min(1, matched / importance);
			if (score === 0) continue;

			const matchedError = document.entry.errorStrings.find((error) => {
				const needle = normalise(error);
				return needle.length >= 6 && haystack.includes(needle);
			});

			if (matchedError !== undefined) score += ERROR_BONUS;
			if (document.questions.some((candidate) => candidate.length > 8 && haystack.includes(candidate))) {
				score += QUESTION_BONUS;
			}
			const titleTokens = tokensOf(document.entry.title);
			if (titleTokens.length > 0 && titleTokens.every((token) => words.includes(token))) score += TITLE_BONUS;

			hits.push({ entry: document.entry, score, coverage, matchedError: matchedError ?? null });
		}

		return hits
			.filter((hit) => hit.coverage >= MIN_COVERAGE)
			.sort((left, right) => right.score - left.score);
	}
}

let index: KnowledgeIndex | null = null;
let indexedEntries: readonly KnowledgeEntry[] | null = null;

/** The corpus is indexed once, and rebuilt only when the corpus itself changes. */
function knowledgeIndex(entries: readonly KnowledgeEntry[]): KnowledgeIndex {
	if (index !== null && indexedEntries === entries) return index;
	index = new KnowledgeIndex(entries);
	indexedEntries = entries;
	return index;
}

export interface RetrieveOptions {
	limit?: number;
	entries: readonly KnowledgeEntry[];
}

/** The entries that answer a question, best first. */
export function retrieveKnowledge(question: string, options: RetrieveOptions): KnowledgeHit[] {
	const platform = detectPlatform(question);
	const topic = detectTopic(question);

	return knowledgeIndex(options.entries)
		.search(question)
		.map((hit) => {
			const entry = hit.entry;
			let score = hit.score;

			if (topic !== null && entry.topic === topic) score *= 1.15;
			if (platform !== "any") {
				if (entry.platform === platform) score *= 1.2;
				else if (entry.platform === "any") score *= 1.05;
				else score *= 0.55;
			}
			if (entry.outdated) score *= 0.7;

			return { ...hit, score };
		})
		.sort((left, right) => right.score - left.score)
		.slice(0, options.limit ?? KNOWLEDGE_LIMITS.retrieved);
}
