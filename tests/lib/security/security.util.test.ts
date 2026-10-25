import { PermissionFlagsBits } from "discord.js";
import {
	channelExportCsv,
	csvCell,
	MAX_CHANNEL_EXPORT_MESSAGES,
	permissionOverrideState,
} from "@lib/security/security.util";

describe("security utilities", () => {
	it("neutralizes spreadsheet formula prefixes while retaining CSV quoting", () => {
		expect(csvCell("=HYPERLINK(1)")).toBe('"\'=HYPERLINK(1)"');
		expect(csvCell("  @SUM(A1:A2)")).toBe('"\'  @SUM(A1:A2)"');
		expect(csvCell("\uFEFF=SUM(1,2)")).toBe('"\'\uFEFF=SUM(1,2)"');
		expect(csvCell('a "quote"')).toBe('"a ""quote"""');
	});

	it("exports a stable CSV header and message rows", () => {
		expect(
			channelExportCsv([
				{
					createdAt: "2026-01-01T00:00:00.000Z",
					author: "user",
					authorId: "123",
					content: "hello",
					attachments: "",
				},
			]),
		).toContain('"createdAt","author","authorId","content","attachments"');
		expect(channelExportCsv([]).split("\n")[0]).toBe('"createdAt","author","authorId","content","attachments"');
	});

	it("caps channel exports at a predictable maximum", () => {
		expect(MAX_CHANNEL_EXPORT_MESSAGES).toBe(100);
	});

	it("restores allow, deny, or inherited permission state", () => {
		expect(permissionOverrideState(PermissionFlagsBits.SendMessages, 0n, PermissionFlagsBits.SendMessages)).toBe(true);
		expect(permissionOverrideState(0n, PermissionFlagsBits.SendMessages, PermissionFlagsBits.SendMessages)).toBe(false);
		expect(permissionOverrideState(0n, 0n, PermissionFlagsBits.SendMessages)).toBe(null);
	});
});
