import { type TestifyClient } from "@core/client";
import { toError } from "@core/errors";
import { refreshZangetsuLive } from "@lib/knowledge/knowledgeLive.util";

/** Keeps the app's release notes and guide snapshot fresh, so the assistant is not answering from last month. */

export interface KnowledgeRefreshResult {
	checked: boolean;
	version: string | null;
	guideChecked: boolean;
	guideChanged: boolean;
	failure: string | null;
}

export async function refreshZangetsuKnowledge(client: TestifyClient): Promise<KnowledgeRefreshResult> {
	try {
		const snapshot = await refreshZangetsuLive();

		if (snapshot.failure !== null) {
			client.logger.warn({ failure: snapshot.failure }, "[KNOWLEDGE] Part of the live check failed; the last good copy is kept.");
		}
		if (snapshot.guideChanged) {
			client.logger.info(
				{ sections: snapshot.guideSections.length },
				"[KNOWLEDGE] The official guide changed since the last check. Review the stored answers.",
			);
		}
		client.logger.debug(
			{ version: snapshot.release?.version ?? null, checkedAt: snapshot.checkedAt },
			"[KNOWLEDGE] Live app facts refreshed.",
		);

		return {
			checked: true,
			version: snapshot.release?.version ?? null,
			guideChecked: snapshot.guideCheckedAt !== null,
			guideChanged: snapshot.guideChanged,
			failure: snapshot.failure,
		};
	} catch (error) {
		client.logger.warn({ err: toError(error) }, "[KNOWLEDGE] The live check failed; the stored answers are unchanged.");
		return { checked: false, version: null, guideChecked: false, guideChanged: false, failure: "refresh failed" };
	}
}
