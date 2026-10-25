import nsfwCommand from "@commands/fun/nsfw.command";
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

	it("does not expose a consent subcommand", () => {
		expect(nsfwCommand.subcommands?.some((subcommand) => subcommand.name === "consent")).toBe(false);
	});
});
