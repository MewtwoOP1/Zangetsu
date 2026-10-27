import {
	DEFAULT_WELCOME_EMBED_SETTINGS,
	WELCOME_LIMITS,
	type WelcomeConfigResponse,
	type WelcomeEmbedSettings,
	type WelcomeStyle,
} from "@testify/shared";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router";
import { ErrorState } from "@/app/ErrorState";
import { ChannelPicker, Field, FIELD, LABEL, SavingIndicator, savingStateOf, Toggle, Warning } from "@/components/form";
import { Button, Card, Eyebrow, PageHeader, Skeleton } from "@/components/primitives";
import { useGuildOverview } from "@/features/guild-overview/useGuildOverview";
import { useChannels } from "@/features/levelling/useLevelling";
import { GreetingPreview } from "@/features/welcome/components/GreetingPreview";
import { PlaceholderHelp } from "@/features/welcome/components/PlaceholderHelp";
import { useUpdateWelcome, useWelcome } from "@/features/welcome/useWelcome";
import { insertToken, messageTooLong, STYLE_LABELS, STYLE_ORDER } from "@/features/welcome/welcome.utils";
import { usePageTitle } from "@/hooks/usePageTitle";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { markupWarning, sanitiseInput } from "@/lib/sanitise";

function embedSettingsFrom(config: WelcomeConfigResponse): WelcomeEmbedSettings {
	return {
		embedTitle: config.embedTitle,
		embedColor: config.embedColor,
		embedAuthor: config.embedAuthor,
		embedAuthorIconUrl: config.embedAuthorIconUrl,
		embedFooter: config.embedFooter,
		embedFooterIconUrl: config.embedFooterIconUrl,
		embedThumbnailUrl: config.embedThumbnailUrl,
		embedImageUrl: config.embedImageUrl,
		embedTimestamp: config.embedTimestamp,
	};
}

export function WelcomePage(): React.JSX.Element {
	const { t } = useTranslation();
	const { guildId = "" } = useParams();

	const config = useWelcome(guildId);
	const channels = useChannels(guildId);
	const overview = useGuildOverview(guildId);
	const update = useUpdateWelcome(guildId);

	usePageTitle(t("welcome.title"), overview.data?.name);

	const textarea = useRef<HTMLTextAreaElement>(null);
	const [draft, setDraft] = useState("");
	const [embedDraft, setEmbedDraft] = useState<WelcomeEmbedSettings>({ ...DEFAULT_WELCOME_EMBED_SETTINGS });

	// Text fields stay local while editing and are persisted on blur, so typing does not send a request per key.
	useEffect(() => {
		if (config.data !== undefined) setDraft(config.data.message);
	}, [config.data?.message]);

	useEffect(() => {
		if (config.data === undefined) return;
		setEmbedDraft(embedSettingsFrom(config.data));
	}, [
		config.data?.embedTitle,
		config.data?.embedColor,
		config.data?.embedAuthor,
		config.data?.embedAuthorIconUrl,
		config.data?.embedFooter,
		config.data?.embedFooterIconUrl,
		config.data?.embedThumbnailUrl,
		config.data?.embedImageUrl,
		config.data?.embedTimestamp,
	]);

	if (config.isPending) return <Skeleton className="h-96 w-full" />;
	if (config.isError) return <ErrorState error={config.error} onRetry={() => void config.refetch()} />;

	const welcome = config.data;
	const dirty = draft !== welcome.message;
	const tooLong = messageTooLong(draft);
	// The stored record requires a channel, so the API refuses every write except "off" until there is one.
	const needsChannel = welcome.channelId === null;
	const embedDirty = (Object.keys(embedDraft) as (keyof WelcomeEmbedSettings)[]).some(
		(field) => embedDraft[field] !== welcome[field],
	);

	function saveEmbedSettings(): void {
		if (embedDirty) update.mutate({ ...embedDraft });
	}

	function saveMessage(): void {
		if (!dirty || tooLong || draft.trim() === "") return;
		update.mutate({ message: sanitiseInput(draft) });
	}

	return (
		<>
			<PageHeader eyebrow={overview.data?.name} title={t("welcome.title")} subtitle={t("welcome.subtitle")} />

			<Card className="motion-pop flex flex-col gap-4">
				<div className="flex items-center justify-between gap-3">
					<Eyebrow as="h2">{t("welcome.greeting")}</Eyebrow>
					<SavingIndicator state={savingStateOf(update.isPending, update.isSuccess)} />
				</div>

				<ChannelPicker
					label={t("welcome.sendTo")}
					hint={t("welcome.sendToHint")}
					channels={channels.data ?? []}
					value={welcome.channelId}
					allowNone={false}
					onChange={(channelId) => {
						update.mutate({ channelId });
					}}
				/>

				{needsChannel && <Warning>{t("welcome.pickFirst")}</Warning>}

				<Toggle
					label={t("welcome.greet")}
					hint={t("welcome.greetHint")}
					checked={welcome.enabled}
					disabled={needsChannel}
					onChange={(enabled) => {
						update.mutate({ enabled });
					}}
				/>

				{/* A `<legend>` is not a flex item, so the gap under it has to be a margin on the group itself. */}
				<fieldset disabled={needsChannel}>
					<legend className={LABEL}>{t("welcome.sentAs")}</legend>
					<div className="mt-2 grid gap-2 sm:grid-cols-3">
						{STYLE_ORDER.map((style) => (
							<StyleChoice
								key={style}
								style={style}
								checked={welcome.style === style}
								disabled={needsChannel}
								onChange={() => {
									update.mutate({ style });
								}}
							/>
						))}
					</div>
				</fieldset>

				{welcome.style === "embed" && (
					<fieldset disabled={needsChannel} className="flex flex-col gap-3">
						<legend className={LABEL}>{t("welcome.embedSettings")}</legend>
						<p className="text-muted-foreground text-xs">{t("welcome.embedSettingsHint")}</p>
						<div className="grid gap-3 sm:grid-cols-2">
							<Field label={t("welcome.embedTitle")} htmlFor="welcome-embed-title">
								<input
									id="welcome-embed-title"
									maxLength={WELCOME_LIMITS.maxEmbedTitle}
									value={embedDraft.embedTitle}
									onChange={(event) => setEmbedDraft((current) => ({ ...current, embedTitle: event.target.value }))}
									className={FIELD}
								/>
							</Field>
							<Field label={t("welcome.embedColor")} htmlFor="welcome-embed-color">
								<input
									id="welcome-embed-color"
									type="color"
									value={embedDraft.embedColor}
									onChange={(event) =>
									setEmbedDraft((current) => ({ ...current, embedColor: event.target.value.toUpperCase() }))
								}
									className="h-10 w-full rounded-field border border-input bg-background px-2"
								/>
							</Field>
							<Field label={t("welcome.embedAuthor")} htmlFor="welcome-embed-author">
								<input
									id="welcome-embed-author"
									maxLength={WELCOME_LIMITS.maxEmbedAuthor}
									value={embedDraft.embedAuthor}
									onChange={(event) => setEmbedDraft((current) => ({ ...current, embedAuthor: event.target.value }))}
									className={FIELD}
								/>
							</Field>
							<Field label={t("welcome.embedAuthorIconUrl")} htmlFor="welcome-embed-author-icon">
								<input
									id="welcome-embed-author-icon"
									type="url"
									placeholder="https://example.com/icon.png"
									value={embedDraft.embedAuthorIconUrl}
									onChange={(event) => setEmbedDraft((current) => ({ ...current, embedAuthorIconUrl: event.target.value }))}
									className={FIELD}
								/>
							</Field>
							<Field label={t("welcome.embedFooter")} htmlFor="welcome-embed-footer">
								<input
									id="welcome-embed-footer"
									maxLength={WELCOME_LIMITS.maxEmbedFooter}
									value={embedDraft.embedFooter}
									onChange={(event) => setEmbedDraft((current) => ({ ...current, embedFooter: event.target.value }))}
									className={FIELD}
								/>
							</Field>
							<Field label={t("welcome.embedFooterIconUrl")} htmlFor="welcome-embed-footer-icon">
								<input
									id="welcome-embed-footer-icon"
									type="url"
									placeholder="https://example.com/icon.png"
									value={embedDraft.embedFooterIconUrl}
									onChange={(event) => setEmbedDraft((current) => ({ ...current, embedFooterIconUrl: event.target.value }))}
									className={FIELD}
								/>
							</Field>
							<Field label={t("welcome.embedThumbnailUrl")} htmlFor="welcome-embed-thumbnail">
								<input
									id="welcome-embed-thumbnail"
									type="url"
									placeholder="https://example.com/thumbnail.png"
									value={embedDraft.embedThumbnailUrl}
									onChange={(event) => setEmbedDraft((current) => ({ ...current, embedThumbnailUrl: event.target.value }))}
									className={FIELD}
								/>
							</Field>
							<Field label={t("welcome.embedImageUrl")} htmlFor="welcome-embed-image">
								<input
									id="welcome-embed-image"
									type="url"
									placeholder="https://example.com/banner.png"
									value={embedDraft.embedImageUrl}
									onChange={(event) => setEmbedDraft((current) => ({ ...current, embedImageUrl: event.target.value }))}
									className={FIELD}
								/>
							</Field>
						</div>
						<Toggle
							label={t("welcome.embedTimestamp")}
							hint={t("welcome.embedTimestampHint")}
							checked={embedDraft.embedTimestamp}
							onChange={(embedTimestamp) => {
								setEmbedDraft((current) => ({ ...current, embedTimestamp }));
							}}
						/>
						<p className="text-muted-foreground text-xs">{t("welcome.embedUrlHint")}</p>
					<div className="flex flex-wrap items-center gap-3">
						<Button onClick={saveEmbedSettings} disabled={!embedDirty || update.isPending}>
							{t("welcome.saveEmbedSettings")}
						</Button>
						<Button
							variant="ghost"
							disabled={!embedDirty || update.isPending}
							onClick={() => setEmbedDraft(embedSettingsFrom(welcome))}
						>
							{t("common.discard")}
						</Button>
					</div>
					</fieldset>
				)}

				{/* The counter is a status, not part of the field's name, so it sits after the control. */}
				<Field label={t("welcome.message")} htmlFor="welcome-message">
					<textarea
						id="welcome-message"
						ref={textarea}
						rows={3}
						value={draft}
						disabled={needsChannel}
						onChange={(event) => {
							setDraft(event.target.value);
						}}
						onBlur={saveMessage}
						className={cn(FIELD, "resize-y font-mono", tooLong && "border-destructive")}
					/>
					<span className="text-muted-foreground text-xs tabular-nums" aria-live="polite">
						{draft.length} of {WELCOME_LIMITS.maxMessage}
					</span>
				</Field>

				<PlaceholderHelp
					disabled={needsChannel}
					onInsert={(token) => {
						setDraft((current) => insertToken(current, token, textarea.current?.selectionStart ?? null));
						textarea.current?.focus();
					}}
				/>

				{markupWarning(draft) !== null && <Warning>{markupWarning(draft)}</Warning>}
				{tooLong && <Warning>{t("welcome.tooLong")}</Warning>}
				{dirty && !tooLong && (
					<div className="flex items-center gap-3">
						<Button onClick={saveMessage} disabled={draft.trim() === ""}>
							{t("welcome.saveMessage")}
						</Button>
						<Button
							variant="ghost"
							onClick={() => {
								setDraft(welcome.message);
							}}
						>
							{t("common.discard")}
						</Button>
					</div>
				)}

				{update.error !== null && (
					<Warning>{update.error instanceof ApiError ? update.error.message : t("common.couldNotSave")}</Warning>
				)}
			</Card>

			<section aria-labelledby="preview-heading" className="flex flex-col gap-3">
				<Eyebrow as="h2" id="preview-heading">
					{t("welcome.preview")}
				</Eyebrow>
				<GreetingPreview
					message={draft}
					style={welcome.style}
					embedSettings={embedDraft}
					guildName={overview.data?.name ?? t("welcome.thisServer")}
					memberCount={overview.data?.memberCount ?? 0}
				/>
			</section>
		</>
	);
}

function StyleChoice({
	style,
	checked,
	disabled,
	onChange,
}: {
	style: WelcomeStyle;
	checked: boolean;
	disabled: boolean;
	onChange: () => void;
}): React.JSX.Element {
	const { t } = useTranslation();
	const { label, describes } = STYLE_LABELS[style];

	return (
		<label
			className={cn(
				"rounded-card flex flex-col gap-1 border p-3 transition-colors duration-150",
				disabled ? "border-border opacity-50" : "cursor-pointer",
				checked ? "border-primary bg-primary/10" : !disabled && "border-border hover:border-input",
			)}
		>
			<span className="flex items-center gap-2">
				<input type="radio" name="welcome-style" checked={checked} disabled={disabled} onChange={onChange} />
				<span className="text-sm font-medium">{t(label)}</span>
			</span>
			<span className="text-muted-foreground text-xs">{t(describes)}</span>
		</label>
	);
}
