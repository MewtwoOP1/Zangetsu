import { defineButton } from "@core/button";
import { UserFacingError } from "@core/errors";
import { changeMediaSession, MEDIA_SESSION_BUTTON_ID } from "@lib/recommendations";

export default defineButton({
  id: MEDIA_SESSION_BUTTON_ID,
  ownerOnly: true,

  async run(interaction, context) {
    if (!interaction.isButton()) return;

    const sessionId = context.args[0];
    if (!sessionId) throw new UserFacingError("This media panel is invalid. Run the command again.");

    try {
      await interaction.update(changeMediaSession(sessionId, interaction.user.id, context.action));
    } catch (error) {
      throw new UserFacingError(error instanceof Error ? error.message : "This media panel is no longer available.");
    }
  },
});
