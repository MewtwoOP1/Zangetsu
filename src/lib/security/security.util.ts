import { PermissionsBitField, type PermissionResolvable } from "discord.js";

/** Keep a channel lockdown reversible without overwriting unrelated permission bits. */
export function permissionOverrideState(
	allow: ConstructorParameters<typeof PermissionsBitField>[0],
	deny: ConstructorParameters<typeof PermissionsBitField>[0],
	permission: PermissionResolvable,
): boolean | null {
	if (new PermissionsBitField(allow).has(permission)) return true;
	if (new PermissionsBitField(deny).has(permission)) return false;
	return null;
}

/** CSV cells are quoted and spreadsheet formula prefixes are neutralized. */
export function csvCell(value: string): string {
	const safe = /^[\t\r\n ]*[=+\-@]/.test(value) ? "'" + value : value;
	return '"' + safe.replace(/"/g, '""') + '"';
}

export interface ChannelExportRow {
	createdAt: string;
	author: string;
	authorId: string;
	content: string;
	attachments: string;
}

export function channelExportCsv(rows: ChannelExportRow[]): string {
	const header = ["createdAt", "author", "authorId", "content", "attachments"];
	const data = rows.map((row) => [row.createdAt, row.author, row.authorId, row.content, row.attachments]);
	return [header, ...data].map((line) => line.map((value) => csvCell(String(value))).join(",")).join("\n") + "\n";
}

export const MAX_CHANNEL_EXPORT_MESSAGES = 100;
