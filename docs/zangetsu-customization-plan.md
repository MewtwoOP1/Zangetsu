# Zangetsu Discord Bot — Customization Plan

This plan applies only to the `MewtwoOP1/Zangetsu` repository and the `zangetsu/customization-dev` branch. The upstream `Kkkermit/Testify` repository is not a target for changes.

## Goals

- Rebrand the bot and user-facing documentation as **Zangetsu**.
- Use the Zangetsu server icon for embed branding: `https://cdn.discordapp.com/icons/1514592000429654196/c07572fcdd3987826f09fdcd490e9b65.webp?size=2048`.
- Keep slash/prefix parity, existing permission checks, database boundaries, dashboard protections and current functionality.
- Add useful commands for a Zangetsu community and its developers after auditing existing commands, to avoid duplicate functionality.
- Keep all implementation work separate from `main`; do not claim tests pass unless CI actually reports success.

## Phase 0 — Baseline and safeguards

1. Run the existing CI against the unmodified application code on this branch.
2. Establish actual baseline results for typechecking, lint, formatting, tests/coverage, build, bundle verification and dependency audit.
3. Inspect the current command registry and generated command documentation before proposing command additions.
4. Retain `LICENSE` and `NOTICE`. The source is Apache 2.0 with the Commons Clause: retain the original attribution and license condition; do not present the source as unrestricted OSI-approved open source or remove Kkermit's notice.

## File-by-file implementation

| Path | Planned work |
| --- | --- |
| `src/config/theme.ts` | Set the displayed developer credit to `MewtwoOP1`, point repository links to Zangetsu, and use the supplied logo URL as the single source for brand imagery; keep colours centralized. Do not invent a Discord invite URL. |
| `src/lib/discord/embeds.util.ts` | Use the Zangetsu logo as the default embed footer icon while preserving explicit per-embed overrides and Discord embed limits. Add/update unit tests. |
| `src/config/categories.ts` | Keep existing categories compatible. Add a category only when a real new command group needs it; preserve unique, readable colours and hidden owner-only categories. |
| `src/core/command.ts`, `src/core/prefix.ts`, `src/core/checks.ts` | Keep the shared command contract and shared authorization checks. Do not fork slash and prefix implementations or bypass permission/owner gates. |
| `src/commands/` | Audit first, then add only missing Zangetsu-focused commands. Candidate groups: structured bug reports, feature suggestions, bot/app status and release information, staff support utilities, reminders/polls, and improved ticket workflows. Use the existing feedback/ticket systems where appropriate instead of duplicating them. |
| `src/buttons/`, `src/events/`, `src/jobs/` | Add handlers or scheduled work only when a new command requires them; validate component ownership, permissions, expiry and failure states. |
| `src/database/models/`, `src/database/repositories/` | Reuse existing persistence for tickets/feedback where possible. Add schemas and repository methods only for genuinely new durable data, with retention rules and tests. |
| `dashboard/src/` and dashboard API routes | Rebrand visible titles/links and add configuration screens only for features supported by the bot. Retain OAuth, CSRF, validation, authorization checks and safe bind defaults. |
| `package.json`, workspace manifests | Update public package metadata and repository/homepage links carefully. Keep internal workspace names and import paths unchanged until a complete, tested migration is justified. |
| `README.md`, `docs/`, `.env.example`, issue templates | Replace user-facing Testify identity and upstream links with accurate Zangetsu details. Document permissions, required intents, setup, privacy and commands. Keep upstream attribution/license documents intact. |
| Tests and generated docs | Add tests for each changed behavior. Run `npm run docs:commands` after command changes; never edit the generated command list manually. |

## Candidate additions (after command audit)

1. **Support and feedback:** improved bug-report and feature-suggestion flows, private staff review, status updates and duplicate prevention.
2. **Release information:** a command that shows the latest published Zangetsu release/changelog once a reliable source is configured; do not hardcode a stale version.
3. **Community tools:** polls, reminders and scheduled announcements, with opt-in configuration and safe limits.
4. **Staff operations:** ticket claiming/assignment, clear transcript controls, audit-friendly staff actions and configurable escalation.
5. **Diagnostics:** owner-only health/config checks that never expose tokens, database credentials, secrets or private user data.

These are candidates, not a promise to create duplicate commands; the existing command tree and data models must be checked first.

## Verification and acceptance criteria

- Run `npm run check`, `npm run test:coverage`, `npm run build` and `npm run audit`.
- Verify the compiled loader actually registers commands and handlers; compilation alone is not sufficient.
- Confirm each added command works through both slash and prefix surfaces when the command contract supports both.
- Test permission failures, invalid input, database failures, missing configuration and interaction timeouts.
- Regenerate and review `docs/commands.md`.
- Inspect the final diff for upstream URLs/branding leaks and accidental secrets.
- Merge nothing into `main` until CI passes and the branch is reviewed.

## Open configuration

- The supplied server icon is known. A Zangetsu Discord invite URL and preferred support channel IDs have not been supplied; use configuration and leave links unset rather than inventing them.
- Keep the upstream license and attribution notice with the derivative project.

## Current execution status

The dedicated branch is `zangetsu/customization-dev`. The first rebrand pass now updates the project identity and logo configuration, embeds and help pages, bot-info copy, README/package metadata, dashboard title and web-app manifest, contributor/security/hosting documentation, issue templates, code of conduct, and support-test fixtures. The original `LICENSE` and upstream notice are retained.

The support-server URL remains unset because a Zangetsu Discord invite URL has not been provided. Help and support surfaces omit the invite button until it is configured.

**Verification is pending.** The baseline and changed code have not been tested in this session, so no tests are claimed to pass. Before merging, run the full acceptance suite above and inspect CI results. The baseline gap should be recorded rather than inferred from existing upstream history.
