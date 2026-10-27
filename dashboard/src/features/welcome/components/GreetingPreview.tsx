import { fillTemplate, type WelcomeConfigResponse, type WelcomeStyle } from "@testify/shared";
import { useTranslation } from "react-i18next";
import { Avatar } from "@/components/primitives";
import { useBot } from "@/features/auth/useBot";
import { markSpans, type MarkSpan } from "@/features/welcome/welcome.utils";
import { BUILT_IN_BOT_NAME } from "@/lib/brand";
import { cn } from "@/lib/cn";

type EmbedPreviewSettings = Pick<
	WelcomeConfigResponse,
	| "embedTitle"
	| "embedColor"
	| "embedAuthor"
	| "embedAuthorIconUrl"
	| "embedFooter"
	| "embedFooterIconUrl"
	| "embedThumbnailUrl"
	| "embedImageUrl"
	| "embedTimestamp"
>;

/** Filled by the same template function the bot uses, so this preview mirrors the greeting that will be sent. */
export function GreetingPreview({
	message,
	style,
	embedSettings,
	guildName,
	memberCount,
}: {
	message: string;
	style: WelcomeStyle;
	embedSettings: EmbedPreviewSettings;
	guildName: string;
	memberCount: number;
}): React.JSX.Element {
	const { t } = useTranslation();
	const bot = useBot();
	const name = bot.data?.name ?? BUILT_IN_BOT_NAME;
	const context = {
		mention: "@newcomer",
		username: "newcomer",
		serverName: guildName,
		memberCount: memberCount + 1,
	};
	const filled = fillTemplate(message, context);
	const title = fillTemplate(embedSettings.embedTitle, context);
	const author = fillTemplate(embedSettings.embedAuthor, context);
	const footer = fillTemplate(embedSettings.embedFooter, context);

	return (
		<div className="bg-background border-border rounded-card border p-4">
			<div className="flex gap-3">
				<Avatar name={name} url={bot.data?.avatarUrl ?? null} size={36} seed={guildName} />
				<div className="min-w-0 flex-1">
					<p className="text-sm font-medium">
						{name} <span className="bg-primary/20 text-accent ml-1 rounded-chip px-1 py-0.5 text-[0.625rem]">BOT</span>
					</p>

					{style === "embed" ? (
						<div
							className="mt-2 max-w-xl rounded-r-field border-l-4 bg-card p-3"
							style={{ borderLeftColor: embedSettings.embedColor }}
						>
							{author !== "" && (
								<div className="mb-2 flex items-center gap-2 text-xs font-medium">
									{embedSettings.embedAuthorIconUrl !== "" && (
										<img src={embedSettings.embedAuthorIconUrl} alt="" className="h-5 w-5 rounded-full object-cover" />
									)}
									<span>{author}</span>
								</div>
							)}
							<div className="flex items-start gap-3">
								<div className="min-w-0 flex-1">
									{title !== "" && <p className="mb-1 break-words text-sm font-semibold">{title}</p>}
									<p className="break-words whitespace-pre-wrap text-sm">
										{markSpans(filled).map((span, index) => (
											<Marked key={index} span={span} />
										))}
									</p>
								</div>
								{embedSettings.embedThumbnailUrl !== "" ? (
									<img
										src={embedSettings.embedThumbnailUrl}
										alt=""
										className="h-16 w-16 shrink-0 rounded-field object-cover"
									/>
								) : (
									<Avatar name="newcomer" url={null} size={56} seed={guildName} />
								)}
							</div>
							{embedSettings.embedImageUrl !== "" && (
								<img
									src={embedSettings.embedImageUrl}
									alt=""
									className="mt-3 max-h-64 w-full rounded-field object-cover"
								/>
							)}
							<div className="text-muted-foreground mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
								{embedSettings.embedFooterIconUrl !== "" && (
									<img src={embedSettings.embedFooterIconUrl} alt="" className="h-4 w-4 rounded-full object-cover" />
								)}
								<span>{footer || `${name} • zangetsu.online`}</span>
								{embedSettings.embedTimestamp && <span>• {t("welcome.timestampPreview")}</span>}
							</div>
						</div>
					) : (
						<div
							className={cn(
								"mt-1 text-sm break-words",
								style === "card" && "border-primary bg-card rounded-r-field border-l-4 p-3",
							)}
						>
							<p className="whitespace-pre-wrap">
								{markSpans(filled).map((span, index) => (
									<Marked key={index} span={span} />
								))}
							</p>
							{style === "card" && (
								<div className="from-primary/30 to-card mt-2 flex h-24 items-center justify-center rounded-field bg-gradient-to-br">
									<span className="text-muted-foreground text-xs">{t("welcome.cardAlt")}</span>
								</div>
							)}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

/** Discord's own marks, so the preview answers "what will this look like" rather than "what did I type". */
function Marked({ span }: { span: MarkSpan }): React.JSX.Element {
	if (span.marks.includes("code"))
		return <code className="bg-muted rounded-chip px-1 py-0.5 font-mono">{span.text}</code>;

	return (
		<span
			className={cn(
				span.marks.includes("bold") && "font-bold",
				span.marks.includes("italic") && "italic",
				span.marks.includes("underline") && "underline",
				span.marks.includes("strike") && "line-through",
			)}
		>
			{span.text}
		</span>
	);
}
