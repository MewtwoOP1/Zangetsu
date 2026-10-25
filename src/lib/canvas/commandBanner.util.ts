import { createCanvas, type Image, type SKRSContext2D, loadImage } from "@napi-rs/canvas";
import { AttachmentBuilder, type EmbedBuilder, type InteractionEditReplyOptions, type InteractionReplyOptions } from "discord.js";
import { theme } from "@config/theme";

/** Compact command-specific JPEGs are generated once and bounded in memory. */
export const COMMAND_BANNER_FILENAME = "zangetsu-command-banner.jpg";
export const COMMAND_BANNER_ATTACHMENT = `attachment://${COMMAND_BANNER_FILENAME}`;

const WIDTH = 1_200;
const HEIGHT = 400;
const LOGO_SIZE = 220;
const CACHE_LIMIT = 128;
const rendered = new Map<string, Buffer>();
let logoPromise: Promise<Image | null> | undefined;

function normalizedLabel(value: string): string {
	const cleaned = value.replace(/\s+/g, " ").trim().replace(/^\/+/, "");
	return cleaned ? `/${cleaned.toLocaleLowerCase()}` : "/command";
}

/** Fetch the actual Zangetsu icon at the already-downscaled URL once; failure falls back to vector mark. */
function zangetsuLogo(): Promise<Image | null> {
	logoPromise ??= (async () => {
		try {
			const response = await fetch(theme.logoUrl, { signal: AbortSignal.timeout(2_500) });
			if (!response.ok) return null;
			return await loadImage(Buffer.from(await response.arrayBuffer()));
		} catch {
			return null;
		}
	})();
	return logoPromise;
}

function drawFallbackMark(ctx: SKRSContext2D): void {
	const cx = WIDTH / 2;
	const cy = 120;
	ctx.save();
	ctx.lineCap = "round";
	ctx.lineJoin = "round";
	for (const [start, end, width] of [[-2.85, -1.25, 8], [-1.03, 0.1, 11], [0.32, 1.45, 7], [1.73, 2.5, 6]] as const) {
		ctx.beginPath();
		ctx.strokeStyle = "#ffffff";
		ctx.lineWidth = width;
		ctx.arc(cx, cy, 88, start, end);
		ctx.stroke();
	}
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
	ctx.restore();
}

function paintLabel(ctx: SKRSContext2D, label: string): void {
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

	ctx.textBaseline = "alphabetic";
	ctx.textAlign = "left";
	ctx.fillStyle = "#ffffff";
	ctx.fillText(slash, startX, 335);
	ctx.fillStyle = "#f50027";
	ctx.fillText(name, startX + slashWidth + gap, 335);
}

async function render(label: string): Promise<Buffer> {
	const canvas = createCanvas(WIDTH, HEIGHT);
	const ctx = canvas.getContext("2d");
	ctx.fillStyle = "#000000";
	ctx.fillRect(0, 0, WIDTH, HEIGHT);

	const logo = await zangetsuLogo();
	if (logo) {
		// The source icon already contains the original white brush ring and red slash.
		ctx.drawImage(logo, (WIDTH - LOGO_SIZE) / 2, 10, LOGO_SIZE, LOGO_SIZE);
	} else {
		drawFallbackMark(ctx);
	}

	// Retain the reference banner's minimal red/black/white aesthetic.
	ctx.fillStyle = "#f50027";
	ctx.fillRect(0, HEIGHT - 4, WIDTH, 4);
	paintLabel(ctx, label);
	return canvas.toBuffer("image/jpeg", 78);
}

/** Compact buffers are cached by command and evicted to bound memory consumption. */
export async function commandBannerBuffer(commandName: string): Promise<Buffer> {
	const label = normalizedLabel(commandName);
	const existing = rendered.get(label);
	if (existing) {
		rendered.delete(label);
		rendered.set(label, existing);
		return existing;
	}

	const buffer = await render(label);
	rendered.set(label, buffer);
	if (rendered.size > CACHE_LIMIT) {
		const oldest = rendered.keys().next().value;
		if (oldest !== undefined) rendered.delete(oldest);
	}
	return buffer;
}

export async function commandBannerFile(commandName: string): Promise<AttachmentBuilder> {
	return new AttachmentBuilder(await commandBannerBuffer(commandName), { name: COMMAND_BANNER_FILENAME });
}

function decorateEmbed(value: unknown): unknown {
	if (value === null || typeof value !== "object") return value;

	const candidate = value as {
		setImage?: (url: string) => unknown;
		data?: { image?: { url?: string }; thumbnail?: { url?: string } };
		toJSON?: () => unknown;
	};
	if (typeof candidate.setImage === "function") {
		const oldImage = candidate.data?.image?.url;
		if (oldImage && oldImage !== theme.bannerUrl && oldImage !== COMMAND_BANNER_ATTACHMENT && !candidate.data?.thumbnail) {
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
	if (!hasBannerAlready) files.push(await commandBannerFile(commandName));

	return { ...options, embeds, files } as T;
}

/** Makes the name normalization testable without rendering a canvas. */
export function commandBannerLabel(commandName: string): string {
	return normalizedLabel(commandName);
}

/** Used by tests to keep cache state isolated. */
export function clearCommandBannerCache(): void {
	rendered.clear();
	logoPromise = undefined;
}
