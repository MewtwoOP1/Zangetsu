import { AttachmentBuilder, MessageFlags } from "discord.js";
import { theme } from "@config/theme";
import { defineCommand } from "@core/command";
import { UserFacingError } from "@core/errors";
import { countMemories, listAllMemories, listMemories } from "@database/repositories/aiMemoryRepository";
import { reply, embed  } from "@lib/discord";
import {
  entitiesOf,
  forgetMemory,
  MEMORY_CATEGORY_LABELS,
  MEMORY_LIMITS,
  MEMORY_TYPE_LABELS,
  rankMemories,
  rememberExplicit,
  tonePreferenceOf,
  type MemoryRecord,
} from "@lib/memory";

const VIEW_PAGE = 12;
const CHOICES_MAX = 25;
const ID_SHOWN = 8;

function memoryLine(memory: MemoryRecord): string {
  const kind = MEMORY_CATEGORY_LABELS[memory.category] ?? memory.category;
  const kept = memory.explicitlyRequested ? " · you asked for this" : "";
  return `**${memory.memoryId.slice(0, ID_SHOWN)}** ${kind}${kept}\n> ${memory.summary}`;
}

function memoryField(memory: MemoryRecord): { name: string; value: string } {
  const kind = MEMORY_TYPE_LABELS[memory.memoryType] ?? memory.memoryType;
  return {
    name: `${MEMORY_CATEGORY_LABELS[memory.category] ?? memory.category} · ${kind} ${memory.memoryId.slice(0, ID_SHOWN)}`,
    value: memory.summary.slice(0, 900),
  };
}

function resolveMemory(memories: readonly MemoryRecord[], typed: string): MemoryRecord {
  const wanted = typed.trim().toLowerCase();
  const exact = memories.find((memory) => memory.memoryId.toLowerCase() === wanted);
  if (exact !== undefined) return exact;

  const matches = memories.filter((memory) => memory.memoryId.toLowerCase().startsWith(wanted));
  const only = matches[0];
  if (matches.length === 1 && only !== undefined) return only;

  if (matches.length === 0) {
    throw new UserFacingError("That is not one of my memories of you. `/ai-memory view` lists what I have.");
  }

  throw new UserFacingError(
    `That matches ${String(matches.length)} memories. Pick one from the list instead of typing it.`,
  );
}

export default defineCommand({
  name: "ai-memory",
  description: "See, correct or delete what Zangetsu remembers about you.",
  category: "info",
  private: true,
  aliases: ["memory"],
  cooldown: 3_000,
  subcommands: [
    {
      name: "view",
      description: "Everything Zangetsu has saved about you.",
      options: [
        {
          name: "category",
          description: "Only show one kind of memory.",
          type: "string",
          choices: Object.entries(MEMORY_CATEGORY_LABELS).map(([value, name]) => ({ name, value })),
        },
      ],
      async run(interaction) {
        const wanted = interaction.options.getString("category");
        const memories = await listMemories(interaction.user.id, interaction.guildId);
        const chosen = wanted === null ? memories : memories.filter((memory) => memory.category === wanted);

        if (chosen.length === 0) {
          await reply(interaction, {
            embeds: [embed({
              category: "info",
              title: "Nothing saved about you",
              description:
                "I have not kept anything about you yet. Say \"remember that ...\" and I will save it, or use `/ai-memory save`.",
            }),
            ],
          });
          return;
        }

        const shown = chosen.slice(0, VIEW_PAGE);
        await reply(interaction, {
          embeds: [embed({
            category: "info",
            title: `What I remember about you (${String(chosen.length)})`,
            description: shown.map(memoryLine).join("\n\n").slice(0, 3_900),
            footer: chosen.length > shown.length ? `Showing ${String(shown.length)} of ${String(chosen.length)}` : undefined,
          }),
          ],
        });
      },
    },
    {
      name: "search",
      description: "Search what Zangetsu remembers about you.",
      options: [
        {
          name: "query",
          description: "What to look for.",
          type: "string",
          required: true,
          maxLength: 200,
          unlogged: true,
        },
      ],
      async run(interaction) {
        const query = interaction.options.getString("query", true);
        const memories = await listMemories(interaction.user.id, interaction.guildId);
        const ranked = rankMemories(memories, query, { entities: entitiesOf(query), limit: VIEW_PAGE });

        if (ranked.length === 0) {
          await reply(interaction, {
            embeds: [embed({
              category: "info",
              title: "Nothing matches that",
              description: `I have ${String(memories.length)} memories about you, and none of them are about that.`,
            }),
            ],
          });
          return;
        }

        await reply(interaction, {
          embeds: [embed({
            category: "info",
            title: `Memories matching "${query.slice(0, 80)}"`,
            fields: ranked.map((entry) => memoryField(entry.memory)),
          }),
          ],
        });
      },
    },
    {
      name: "save",
      description: "Ask Zangetsu to remember something about you.",
      options: [
        {
          name: "text",
          description: "What to remember.",
          type: "string",
          required: true,
          maxLength: MEMORY_LIMITS.contentChars,
          unlogged: true,
        },
      ],
      async run(interaction) {
        const text = interaction.options.getString("text", true).trim();
        if (text === "") throw new UserFacingError("There is nothing there to remember.");

        const result = await rememberExplicit(text, {
          userId: interaction.user.id,
          guildId: interaction.guildId,
          entities: entitiesOf(text),
        });

        if (result.memory === null) {
          throw new UserFacingError("I could not save that just now. Try again in a moment.");
        }

        const what =
          result.outcome === "created"
            ? "Saved."
            : result.outcome === "updated"
              ? "Updated what I already had."
              : "Saved, and it replaces what I had before.";

        await reply(interaction, {
          embeds: [embed({
            colour: theme.colours.success,
            title: what,
            description: `> ${result.memory.summary}\n\nOnly you and I can see this, and \`/ai-memory forget\` removes it.`,
          }),
          ],
        });
      },
    },
    {
      name: "forget",
      description: "Delete one thing Zangetsu remembers about you.",
      options: [
        {
          name: "memory",
          description: "Which memory. Pick one from the list.",
          type: "string",
          required: true,
          autocomplete: true,
          unlogged: true,
        },
      ],
      async run(interaction) {
        const typed = interaction.options.getString("memory", true);
        const memories = await listAllMemories(interaction.user.id, MEMORY_LIMITS.maxExport);
        const memory = resolveMemory(memories, typed);
        const removed = await forgetMemory(interaction.user.id, memory.memoryId);

        await reply(interaction, {
          embeds: [embed({
            colour: removed ? theme.colours.success : theme.colours.warning,
            title: removed ? "Forgotten" : "It was already gone",
            description: removed ? `I no longer remember: **${memory.summary}**` : "Nothing was stored under that one.",
          }),
          ],
        });
      },
    },
    {
      name: "clear",
      description: "Delete everything Zangetsu remembers about you.",
      options: [
        {
          name: "confirm",
          description: "This cannot be undone.",
          type: "boolean",
          required: true,
        },
      ],
      async run(interaction) {
        if (interaction.options.getBoolean("confirm") !== true) {
          throw new UserFacingError("Nothing was deleted. Run it again with `confirm` set to true.");
        }

        const removed = await listAllMemories(interaction.user.id, MEMORY_LIMITS.maxExport);
        for (const memory of removed) await forgetMemory(interaction.user.id, memory.memoryId);

        await reply(interaction, {
          embeds: [embed({
            colour: theme.colours.success,
            title: removed.length === 0 ? "Nothing to delete" : `Deleted ${String(removed.length)} memories`,
            description: "Everything I had saved about you is gone, and nothing was kept.",
          }),
          ],
        });
      },
    },
    {
      name: "export",
      description: "Download everything Zangetsu remembers about you as JSON.",
      async run(interaction) {
        const memories = await listAllMemories(interaction.user.id, MEMORY_LIMITS.maxExport);
        const payload = JSON.stringify(
          {
            exportedAt: new Date().toISOString(),
            userId: interaction.user.id,
            count: memories.length,
            memories: memories.map((memory) => ({
              memoryId: memory.memoryId,
              category: memory.category,
              memoryType: memory.memoryType,
              scope: memory.scope,
              content: memory.content,
              summary: memory.summary,
              entities: memory.entities,
              confidence: memory.confidence,
              importance: memory.importance,
              explicitlyRequested: memory.explicitlyRequested,
              isActive: memory.isActive,
              version: memory.version,
              createdAt: memory.createdAt,
              updatedAt: memory.updatedAt,
            })),
          },
          null,
          2,
        );

        await reply(interaction, {
          files: [new AttachmentBuilder(Buffer.from(payload, "utf8"), { name: "zangetsu-memory.json" })],
          flags: MessageFlags.Ephemeral,
        });
      },
    },
    {
      name: "status",
      description: "How much Zangetsu remembers, and how it is set to talk to you.",
      async run(interaction) {
        const guildId = interaction.guildId;
        const memories = await listMemories(interaction.user.id, guildId);
        const total = await countMemories(interaction.user.id);
        const tone = tonePreferenceOf(memories);

        const byCategory = new Map<string, number>();
        for (const memory of memories) {
          byCategory.set(memory.category, (byCategory.get(memory.category) ?? 0) + 1);
        }

        const breakdown =
          byCategory.size === 0
            ? "Nothing yet."
            : [...byCategory.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([category, count]) => `${MEMORY_CATEGORY_LABELS[category] ?? category}: ${String(count)}`)
                .join(" · ");

        const shared = memories.filter((memory) => memory.scope === "guild").length;

        await reply(interaction, {
          embeds: [embed({
            category: "info",
            title: "Memory status",
            fields: [
              { name: "Saved here", value: `${String(memories.length)} of ${String(MEMORY_LIMITS.maxPerUser)}`, inline: true },
              { name: "Saved in total", value: String(total), inline: true },
              { name: "Tone", value: tone ?? "No preference saved", inline: true },
              { name: "By category", value: breakdown },
              { name: "Shared with this server", value:
                shared === 0
                  ? "None. Everything saved here is yours alone."
                  : `${String(shared)} reusable notes that name nobody, kept for this server.` },
            ],
            footer: "Memories are stored in the bot's own database and never expire on their own.",
          }),
          ],
        });
      },
    },
  ],

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    if (focused.name !== "memory") {
      await interaction.respond([]);
      return;
    }

    const typed = String(focused.value).toLowerCase();
    const memories = await listAllMemories(interaction.user.id, MEMORY_LIMITS.maxPerUser);
    const choices = memories
      .filter((memory) => typed === "" || memory.summary.toLowerCase().includes(typed))
      .slice(0, CHOICES_MAX)
      .map((memory) => ({
        name: `${MEMORY_CATEGORY_LABELS[memory.category] ?? memory.category}: ${memory.summary}`.slice(0, 100),
        value: memory.memoryId,
      }));

    await interaction.respond(choices);
  },
});