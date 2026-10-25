import { randomUUID } from "node:crypto";
import { ButtonStyle } from "discord.js";
import { customId } from "@core/button";
import { button, linkButton, row } from "@lib/discord/components.util";
import { embed } from "@lib/discord/embeds.util";
import type { MediaRecommendation } from "./recommendations.util";

export const MEDIA_SESSION_BUTTON_ID = "mediaSession";
const SESSION_TTL_MS = 30 * 60_000;
const MAX_SESSIONS = 1_000;

type SessionMode = "recommendation" | "lookup";

interface MediaSession {
	id: string;
	userId: string;
	mode: SessionMode;
	items: MediaRecommendation[];
	index: number;
	showStats: boolean;
	query?: string;
	expiresAt: number;
}

const sessions = new Map<string, MediaSession>();

/** Randomizes recommendation order without mutating the shared catalogue cache; lookups remain ranked. */
export function shuffleRecommendations<T>(items: readonly T[], random: () => number = Math.random): T[] {
	const shuffled = [...items];
	for (let index = shuffled.length - 1; index > 0; index -= 1) {
		const target = Math.floor(random() * (index + 1));
		[shuffled[index], shuffled[target]] = [shuffled[target]!, shuffled[index]!];
	}
	return shuffled;
}

function cleanExpiredSessions(now = Date.now()): void {
	for (const [id, session] of sessions) {
		if (session.expiresAt <= now) sessions.delete(id);
	}
}

function formatEnum(value: string | null | undefined): string {
	if (!value) return "Not listed";
	return value
		.replace(/[_-]+/g, " ")
		.toLocaleLowerCase()
		.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function count(value: number | null | undefined): string {
	return value == null ? "Not listed" : new Intl.NumberFormat("en-US").format(value);
}

function score(value: number | null): string {
	return value == null ? "Not rated" : `${value.toFixed(1)}/10`;
}

function sourceCredit(item: MediaRecommendation): string {
	if (item.source === "TMDB") {
		return "Data by TMDB. This product uses the TMDB API but is not endorsed or certified by TMDB.";
	}
	return "Ranked from AniList catalogue data • Data: AniList";
}

function cardFor(session: MediaSession): ReturnType<typeof embed> {
	const item = session.items[session.index];
	if (!item) throw new Error("The media session has no item at the selected position.");

	const typeLabel =
		item.mediaType === "anime"
			? "Anime"
			: item.mediaType === "movie"
				? "Movie"
				: item.mediaType === "series"
					? "TV Series"
					: "Media";
	const heading = session.mode === "lookup" ? "MEDIA LOOKUP" : "TOP-RANKED PICKS";
	const position = `${String(session.index + 1).padStart(2, "0")} / ${String(session.items.length).padStart(2, "0")}`;
	const fields = [
		{ name: "⭐ Score", value: score(item.rating), inline: true },
		{ name: "📅 Year", value: item.year == null ? "Unknown" : String(item.year), inline: true },
		{ name: "🎭 Genres", value: item.genres.slice(0, 6).join(" • ") || "Not listed", inline: false },
	];

	if (!session.showStats) {
		if (item.source === "AniList") {
			fields.push(
				{ name: "📺 Episodes", value: item.episodes == null ? "Unknown" : String(item.episodes), inline: true },
				{ name: "📌 Status", value: formatEnum(item.status), inline: true },
			);
		} else {
			fields.push(
				{ name: "🗳️ Votes", value: count(item.voteCount), inline: true },
				{
					name: "📈 Popularity",
					value: item.popularity == null ? "Not listed" : item.popularity.toFixed(1),
					inline: true,
				},
			);
		}
	} else if (item.source === "AniList") {
		fields.push(
			{ name: "🎞️ Format", value: formatEnum(item.format), inline: true },
			{ name: "📌 Status", value: formatEnum(item.status), inline: true },
			{ name: "📺 Episodes", value: item.episodes == null ? "Not listed" : String(item.episodes), inline: true },
			{
				name: "⏱️ Runtime",
				value: item.duration == null ? "Not listed" : `${item.duration} min/episode`,
				inline: true,
			},
			{ name: "🏆 AniList rank", value: item.rank == null ? "Not ranked" : `#${count(item.rank)}`, inline: true },
			{
				name: "🔥 Popularity rank",
				value: item.popularityRank == null ? "Not ranked" : `#${count(item.popularityRank)}`,
				inline: true,
			},
			{ name: "👥 Popularity", value: count(item.popularity), inline: true },
			{ name: "💗 Favorites", value: count(item.favourites), inline: true },
		);
	} else {
		fields.push(
			{ name: "🗳️ TMDB votes", value: count(item.voteCount), inline: true },
			{
				name: "📈 Popularity",
				value: item.popularity == null ? "Not listed" : item.popularity.toFixed(1),
				inline: true,
			},
		);
	}

	return embed({
		category: "community",
		author: { name: `ZANGETSU  •  ${heading}  •  ${position}` },
		title: `${typeLabel}  |  ${item.title}`,
		url: item.url,
		description: item.summary || "No synopsis is available.",
		...(item.poster ? { thumbnail: item.poster } : {}),
		fields,
		footer: `${sourceCredit(item)}${session.mode === "lookup" && session.query ? ` • Search: ${session.query}` : ""}`,
		timestamp: false,
	});
}

/** Builds the initial response and stores only the small, short-lived catalogue result set in memory. */
export function createMediaSession(input: {
	userId: string;
	items: MediaRecommendation[];
	mode: SessionMode;
	query?: string;
}): { embeds: ReturnType<typeof embed>[]; components: ReturnType<typeof row>[] } {
	cleanExpiredSessions();
	if (sessions.size >= MAX_SESSIONS) {
		const oldest = sessions.keys().next().value;
		if (oldest !== undefined) sessions.delete(oldest);
	}

	const id = randomUUID().replace(/-/g, "").slice(0, 12);
	const session: MediaSession = {
		id,
		userId: input.userId,
		mode: input.mode,
		items: input.mode === "recommendation" ? shuffleRecommendations(input.items) : [...input.items],
		index: 0,
		showStats: false,
		...(input.query ? { query: input.query } : {}),
		expiresAt: Date.now() + SESSION_TTL_MS,
	};
	sessions.set(id, session);
	return mediaSessionPayload(session);
}

/** Re-renders the same message after Next or Stats is pressed. */
export function changeMediaSession(
	sessionId: string,
	userId: string,
	action: string,
): { embeds: ReturnType<typeof embed>[]; components: ReturnType<typeof row>[] } {
	cleanExpiredSessions();
	const session = sessions.get(sessionId);
	if (!session || session.userId !== userId) throw new Error("This media panel expired. Run the command again.");

	if (action === "next") {
		session.index = (session.index + 1) % session.items.length;
	} else if (action === "stats") {
		session.showStats = !session.showStats;
	} else {
		throw new Error("Unknown media panel action.");
	}

	session.expiresAt = Date.now() + SESSION_TTL_MS;
	return mediaSessionPayload(session);
}

function mediaSessionPayload(
	session: MediaSession,
): { embeds: ReturnType<typeof embed>[]; components: ReturnType<typeof row>[] } {
	const item = session.items[session.index];
	if (!item) throw new Error("This media panel has no results.");

	const nextLabel =
		session.items.length <= 1
			? "Only result"
			: session.index === session.items.length - 1
				? session.mode === "lookup"
					? "Start over"
					: "More top picks"
				: session.mode === "lookup"
					? "Next result"
					: "Next recommendation";

	return {
		embeds: [cardFor(session)],
		components: [
			row(
				button({
					id: customId(MEDIA_SESSION_BUTTON_ID, "next", session.id, session.userId),
					label: nextLabel,
					emoji: session.mode === "lookup" ? "🔎" : "⏭️",
					style: ButtonStyle.Primary,
					disabled: session.items.length <= 1,
				}),
				button({
					id: customId(MEDIA_SESSION_BUTTON_ID, "stats", session.id, session.userId),
					label: session.showStats ? "Hide stats" : "Full stats",
					emoji: "📊",
					style: ButtonStyle.Secondary,
				}),
				linkButton(
					item.url.startsWith("https://zangetsu.online/open/") ? "Open in Zangetsu" : "Open on AniList",
					item.url,
					"▶️",
				),
			),
		],
	};
}

/** Test-only cleanup keeps in-memory session state isolated. */
export function clearMediaSessions(): void {
	sessions.clear();
}
