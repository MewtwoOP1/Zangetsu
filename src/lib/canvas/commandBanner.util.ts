import { createCanvas, type Image, loadImage } from "@napi-rs/canvas";
import { AttachmentBuilder, type EmbedBuilder, type InteractionEditReplyOptions, type InteractionReplyOptions } from "discord.js";
import { theme } from "@config/theme";

/** Small, command-specific JPEGs keep the banner recognizable without shipping a full-resolution image per command. */
export const COMMAND_BANNER_FILENAME = "zangetsu-command-banner.jpg";
export const COMMAND_BANNER_ATTACHMENT = `attachment://${COMMAND_BANNER_FILENAME}`;

const WIDTH = 1_200;
const HEIGHT = 400;
const LOGO_SIZE = 218;
const CACHE_LIMIT = 128;
const rendered = new Map<string, Buffer>();

function normalizedLabel(value: string): string {
	const cleaned = value.replace(/\s+/g, " ").trim().replace(/^\/+/, "");
	return cleaned ? `/${cleaned.toLocaleLowerCase()}` : "/command";
}

/** Draws the white circular mark and red/white slash locally, so rendering does not depend on a remote image request. */
function drawZangetsuMark(ctx: ReturnType<ReturnType<typeof createCanvas>["getContext"]>): void {
	const cx = WIDTH / 2;
	const cy = 127;
	ctx.save();
	ctx.lineCap = "round";
	ctx.lineJoin = "round";

	// Broken, brush-like ring instead of a perfect circle.
	ctx.strokeStyle = "#ffffff";
	ctx.lineWidth = 9;
	for (const [start, end, width] of [
		[-2.85, -1.25, 8],
		[-1.03, 0.1, 11],
		[0.32, 1.45, 7],
		[1.73, 2.5, 6],
	] as const) {
		ctx.beginPath();
		ctx.lineWidth = width;
		ctx.arc(cx, cy, 94, start, end);
		ctx.stroke();
	}

	// The diagonal slash follows the reference's strong white blade and red accent.
	ctx.strokeStyle = "#f50027";
	ctx.lineWidth = 8;
	ctx.beginPath();
	ctx.moveTo(cx - 8, cy - 6);
	ctx.lineTo(cx + 125, cy - 99);
	ctx.stroke();

	ctx.strokeStyle = "#ffffff";
	ctx.lineWidth = 13;
	ctx.beginPath();
	ctx.moveTo(cx - 128, cy + 102);
	ctx.lineTo(cx + 100, cy - 51);
	ctx.stroke();

	ctx.strokeStyle = "#ffffff";
	ctx.lineWidth = 3;
	ctx.beginPath();
	ctx.moveTo(cx - 142, cy + 113);
	ctx.lineTo(cx + 112, cy - 58);
	ctx.stroke();
	ctx.restore();
}

function paintLabel(ctx: ReturnType<ReturnType<typeof createCanvas>["getContext"]>, label: string): void {
	const text = normalizedLabel(label);
	const slash = "/";
	const name = text.slice(1);
	let size = 62;
	ctx.font = `700 ${size}px Arial, Helvetica, sans-serif`;
	while (size > 30 && ctx.measureText(`${slash} ${name}`).width > WIDTH - 120) {
		size -= 2;
		ctx.font = `700 ${size}px Arial, Helvetica, sans-serif`;
	}
	const gap = size * 0.34;
	const slashWidth = ctx.measureText(slash).width;
	const nameWidth = ctx.measureText(name).width;
	const startX = (WIDTH - slashWidth - gap - nameWidth) / 2;
	const baseline = 335;

	ctx.textBaseline = "alphabetic";
	ctx.textAlign = "left";
	ctx.fillStyle = "#ffffff";
	ctx.fillText(slash, startX, baseline);
	ctx.fillStyle = "#f50027";
	ctx.fillText(name, startX + slashWidth + gap, baseline);
}

function render(label: string): Buffer {
	const canvas = createCanvas(WIDTH, HEIGHT);
	const ctx = canvas.getContext("2d");
	ctx.fillStyle = "#000000";
	ctx.fillRect(0, 0, WIDTH, HEIGHT);

	// Thin red accent strokes echo the supplied reference without adding visual clutter.
	ctx.fillStyle = "#f50027";
	ctx.fillRect(0, HEIGHT - 5, WIDTH, 5);
	ctx.fillRect(0, 0, WIDTH, 3);

	drawZangetsuMark(ctx);
	paintLabel(ctx, label);
	return canvas.toBuffer("image/jpeg", 82);
}

/** The cache stores only compact buffers and evicts old command labels to bound memory usage. */
export function commandBannerBuffer(commandName: string): Buffer {
	const label = normalizedLabel(commandName);
	const existing = rendered.get(label);
	if (existing) {
		rendered.delete(label);
		rendered.set(label, existing);
		return existing;
	}

	const buffer = render(label);
	rendered.set(label, buffer);
	if (rendered.size > CACHE_LIMIT) {
		const oldest = rendered.keys().next().value;
		if (oldest !== undefined) rendered.delete(oldest);
	}
	return buffer;
}

export function commandBannerFile(commandName: string): AttachmentBuilder {
	return new AttachmentBuilder(commandBannerBuffer(commandName), { name: COMMAND_BANNER_FILENAME });
}

function decorateEmbed(value: unknown): unknown {
	if (value === null || typeof value !== "object") return value;

	const candidate = value as { setImage?: (url: string) => unknown; data?: { image?: { url?: string }; thumbnail?: { url?: string } }; toJSON?: () => unknown };
	if (typeof candidate.setImage === "function") {
		const oldImage = candidate.data?.image?.url;
		if (oldImage && oldImage !== theme.bannerUrl && oldImage !== COMMAND_BANNER_ATTACHMENT && !candidate.data?.thumbnail) {
			// Keep a custom image visible rather than discarding it behind the command banner.
			(candidate as EmbedBuilder).setThumbnail(oldImage);
		}
		(candidate as EmbedBuilder).setImage(COMMAND_BANNER_ATTACHMENT);
		return value;
	}

	const raw = (typeof candidate.toJSON === "function" ? candidate.toJSON() : value) as {
		image?: { url?: string };
		thumbnail?: { url?: string };
		[key: string]: unknown;
	};
	const oldImage = raw.image?.url;
	return {
		...raw,
		...(oldImage && oldImage !== theme.bannerUrl && oldImage !== COMMAND_BANNER_ATTACHMENT && !raw.thumbnail
			? { thumbnail: { url: oldImage } }
			: {}),
		image: { url: COMMAND_BANNER_ATTACHMENT },
	};
}

/** Adds the generated banner only to embed replies; text-only commands and their payloads are untouched. */
export async function withCommandBannerPayload<T extends InteractionReplyOptions | InteractionEditReplyOptions | string>(
	options: T,
	commandName: string,
): Promise<T> {
	if (typeof options === "string" || !("embeds" in options) || !options.embeds?.length) return options;

	const hasBannerAlready = options.embeds.some((item) => {
		if (!item || typeof item !== "object") return false;
		const current = item as { data?: { image?: { url?: string } }; image?: { url?: string } };
		return current.data?.image?.url === COMMAND_BANNER_ATTACHMENT || current.image?.url === COMMAND_BANNER_ATTACHMENT;
	});
	const embeds = options.embeds.map(decorateEmbed);
	const files = [...(options.files ?? [])];
	if (!hasBannerAlready) files.push(commandBannerFile(commandName));

	return { ...options, embeds, files } as T;
}

/** Makes the name normalization testable without rendering a canvas. */
export function commandBannerLabel(commandName: string): string {
	return normalizedLabel(commandName);
}

/** Used by tests to keep cache state isolated. */
export function clearCommandBannerCache(): void {
	rendered.clear();
}
