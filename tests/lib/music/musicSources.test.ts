import { UserFacingError } from "@core/errors";
import { type Query } from "@lib/music/music.types";
import {
	allowsSource,
	fallsBackToSoundCloud,
	normaliseMusicSources,
	searchSourceFor,
	sourcesLine,
	withinSources,
} from "@lib/music/musicSources.util";

jest.mock("@database/repositories/botSettingsRepository", () => ({
	getBotSettings: jest.fn(),
	saveBotSettings: jest.fn(),
}));

const plain: Query = { kind: "search", terms: "lofi beats", source: "youtube" };
const youtubeLink: Query = { kind: "url", url: "https://youtu.be/abc", source: "youtube" };
const soundCloudLink: Query = { kind: "url", url: "https://soundcloud.com/a/b", source: "soundcloud" };
const spotifyLink: Query = { kind: "url", url: "https://open.spotify.com/track/abc", source: "spotify" };
const otherLink: Query = { kind: "url", url: "https://example.com/song.mp3", source: "other" };

describe("normaliseMusicSources", () => {
	/** A fresh bot uses the new SoundCloud-only default. */
	it("reads no setting as SoundCloud-only by default", () => {
		expect(normaliseMusicSources(null)).toEqual({ sources: "soundcloud", configured: false });
		expect(normaliseMusicSources({ musicSources: "soundcloud" })).toEqual({ sources: "soundcloud", configured: true });
	});
});

describe("allowsSource", () => {
	it.each([
		["both", "youtube", false],
		["both", "soundcloud", true],
		["youtube", "soundcloud", true],
		["soundcloud", "youtube", false],
		["youtube", "youtube", false],
		["soundcloud", "soundcloud", true],
	] as const)("with %s, %s is allowed: %s", (sources, source, allowed) => {
		expect(allowsSource(sources, source)).toBe(allowed);
	});

	/** The switch is about two services; a link to anywhere else was never the owner's to refuse. */
	it("rejects non-SoundCloud sources", () => {
		expect(allowsSource("youtube", "other")).toBe(false);
		expect(allowsSource("soundcloud", "other")).toBe(false);
	});
});

describe("withinSources", () => {
	it("sends a plain search wherever the owner points", () => {
		expect(withinSources(plain, "soundcloud")).toMatchObject({ source: "soundcloud" });
		expect(withinSources(plain, "youtube")).toMatchObject({ source: "soundcloud" });
		expect(withinSources(plain, "both")).toMatchObject({ source: "soundcloud" });
		expect(searchSourceFor("soundcloud")).toBe("soundcloud");
	});

	it("rejects an explicitly requested YouTube search", () => {
		const named: Query = { kind: "search", terms: "lofi beats", source: "youtube", named: true };
		expect(() => withinSources(named, "soundcloud")).toThrow(/SoundCloud-only/);
	});

	it("keeps a named SoundCloud search in SoundCloud-only mode", () => {
		const named: Query = { kind: "search", terms: "x", source: "soundcloud", named: true };

		expect(withinSources(named, "both")).toBe(named);
		expect(withinSources(named, "youtube")).toBe(named);
	});

	/** Turning a service off has to cover links as well, or pasting one would walk straight past the switch. */
	it("refuses a link to a service that is switched off, and says which is left", () => {
		expect(() => withinSources(youtubeLink, "soundcloud")).toThrow(UserFacingError);
		expect(() => withinSources(youtubeLink, "soundcloud")).toThrow(/SoundCloud-only/);
		expect(() => withinSources(spotifyLink, "soundcloud")).toThrow(/SoundCloud-only/);
		expect(() => withinSources(otherLink, "soundcloud")).toThrow(/SoundCloud-only/);
		expect(withinSources(soundCloudLink, "youtube")).toBe(soundCloudLink);
		expect(withinSources(soundCloudLink, "both")).toBe(soundCloudLink);
	});
});

describe("fallsBackToSoundCloud", () => {
	it("moves only a plain YouTube search, and only while both are allowed", () => {
		expect(fallsBackToSoundCloud(plain, "both")).toBe(false);
		expect(fallsBackToSoundCloud(plain, "youtube")).toBe(false);
		expect(fallsBackToSoundCloud(youtubeLink, "both")).toBe(false);
		expect(fallsBackToSoundCloud({ ...plain, named: true }, "both")).toBe(false);
	});
});

describe("sourcesLine", () => {
	it("tells a server which services it gets", () => {
		expect(sourcesLine("both")).toMatch(/SoundCloud only/);
		expect(sourcesLine("youtube")).toMatch(/SoundCloud only/);
		expect(sourcesLine("soundcloud")).toMatch(/SoundCloud only/);
	});
});
