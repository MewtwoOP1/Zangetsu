import { UserFacingError } from "@core/errors";
import { getBotSettings, saveBotSettings, type StoredBotSettings } from "@database/repositories/botSettingsRepository";
import { type MusicSource, type Query } from "@lib/music/music.types";
import { type MusicSourceChoice, type MusicSourceSetting } from "@testify/shared";

/** Which services the player takes music from, as the bot's owner chose for every server at once. */

export function normaliseMusicSources(stored: StoredBotSettings): MusicSourceSetting {
	return { sources: "soundcloud", configured: stored !== null };
}

export async function readMusicSourceSetting(): Promise<MusicSourceSetting> {
	return normaliseMusicSources(await getBotSettings());
}

export async function readMusicSources(): Promise<MusicSourceChoice> {
	return (await readMusicSourceSetting()).sources;
}

const NAMES: Record<MusicSourceChoice, string> = {
	both: "YouTube and SoundCloud",
	youtube: "YouTube only",
	soundcloud: "SoundCloud only",
};

export function sourcesName(_sources: MusicSourceChoice): string {
	return NAMES.soundcloud;
}

export async function applyMusicSources(
	_sources: MusicSourceChoice,
	actorId: string | null,
): Promise<MusicSourceSetting> {
	await saveBotSettings({ musicSources: "soundcloud" }, actorId);
	return { sources: "soundcloud", configured: true };
}

/** Links to any other site are not the owner's to switch, so only YouTube and SoundCloud can be refused. */
export function allowsSource(sources: MusicSourceChoice, source: MusicSource): boolean {
	return source === "soundcloud";
}

const SOURCE_LINE = "🎵 **Source** — SoundCloud only. `/play` searches SoundCloud by title or accepts a SoundCloud link.";

/** What `/music status` says about the owner's choice. */
export function sourcesLine(sources: MusicSourceChoice): string {
	return SOURCE_LINE;
}

/** Where a search that names no service goes. */
export function searchSourceFor(_sources: MusicSourceChoice): MusicSource {
	return "soundcloud";
}

/** Only a plain search on YouTube moves to SoundCloud, and only while the owner allows both. */
export function fallsBackToSoundCloud(_query: Query, _sources: MusicSourceChoice): boolean {
	return false;
}

const OFF: Record<"youtube" | "soundcloud", string> = {
	youtube: "Zangetsu music is SoundCloud-only. Search by title or paste a SoundCloud link.",
	soundcloud: "SoundCloud is the only enabled music source.",
};

/** The query as the owner's choice allows it: an unnamed search goes where they point, and a service they turned off is refused. */
export function withinSources(query: Query, sources: MusicSourceChoice): Query {
	if (query.kind === "search" && query.named !== true) return { ...query, source: "soundcloud" };

	if (query.source === "youtube" || query.source === "soundcloud") {
		if (!allowsSource(sources, query.source)) throw new UserFacingError(OFF[query.source]);
	}

	return query;
}
