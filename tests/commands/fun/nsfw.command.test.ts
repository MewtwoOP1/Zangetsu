import nsfwCommand from "@commands/fun/nsfw.command";
import { buildSlashCommand } from "@core/command";
import { NSFW_GIF_CATEGORIES } from "@lib/nsfw/nsfwGif.util";

describe("NSFW command options", () => {
	it("exposes an optional target-user option on every GIF category subcommand", () => {
		const categoryCommands = (nsfwCommand.subcommands ?? []).filter((subcommand) =>
			NSFW_GIF_CATEGORIES.some((category) => category === subcommand.name),
		);

		expect(categoryCommands).toHaveLength(NSFW_GIF_CATEGORIES.length);
		for (const subcommand of categoryCommands) {
			expect(subcommand.options).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ name: "target", type: "user", required: false }),
				]),
			);
		}
	});

	it("serializes the target field into Discord's slash-command schema", () => {
		const serialized = buildSlashCommand(nsfwCommand).toJSON();
		const fuck = serialized.options?.find((option) => option.name === "fuck");
		expect(fuck?.options?.some((option) => option.name === "target")).toBe(true);
	});

	it("does not expose a consent subcommand", () => {
		expect(nsfwCommand.subcommands?.some((subcommand) => subcommand.name === "consent")).toBe(false);
	});
});
