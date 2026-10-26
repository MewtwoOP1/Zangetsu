import advice from "@commands/community/subcommands/advice.command";
import anime from "@commands/community/subcommands/anime.command";
import animalFacts from "@commands/community/subcommands/animalFacts.command";
import meme from "@commands/community/subcommands/meme.command";
import minecraft from "@commands/community/subcommands/minecraft.command";
import media from "@commands/community/subcommands/media.command";
import recommend from "@commands/community/subcommands/recommend.command";
import translate from "@commands/community/subcommands/translate.command";
import wiki from "@commands/community/subcommands/wiki.command";
import { asSubcommand, defineCommand } from "@core/command";

/** Discord allows an application 100 commands, so related ones live together here. */
export default defineCommand({
	name: "lookup",
	description: "Looks something up for you.",
	category: "community",

	subcommands: [
		asSubcommand(advice),
		asSubcommand(anime),
		asSubcommand(animalFacts, ["animalfact"]),
		asSubcommand(meme),
		asSubcommand(minecraft),
		asSubcommand(media),
		asSubcommand(recommend),
		asSubcommand(translate),
		asSubcommand(wiki),
	],
});
