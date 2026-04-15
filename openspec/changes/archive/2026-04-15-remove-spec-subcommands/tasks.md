## 1. Remove handler module and orphaned utilities

- [x] 1.1 Delete `commands/spec.ts` entirely.
- [x] 1.2 Delete `utils/openspec.ts` entirely (the only consumer was `commands/spec.ts`).
- [x] 1.3 Delete `utils/change-select-render.tsx` entirely (the only consumer was `commands/spec.ts`).
- [x] 1.4 Delete `components/change-select.tsx` entirely (the only consumer was `utils/change-select-render.tsx`).
- [x] 1.5 Edit `utils/proposal.ts`: convert `extractProposalTitle` from an exported function to a private one (it is still used internally by `getActiveChanges`). Delete `getLatestChangeId` entirely. Keep `getActiveChanges` and the `ActiveChange` interface — `commands/changes.ts` still uses them.
- [x] 1.6 Delete `utils/claude.ts` entirely (the only consumer was `commands/spec.ts`; its test file is the only remaining reference).
- [x] 1.7 Delete `utils/claude.test.ts` entirely (it only tests `getAgentCommand`, which is being deleted).

## 2. Update routing and help

- [x] 2.1 Edit `router.ts`: remove the `import { handleSpecApply, handleSpecArchive, handleSpecPropose } from './commands/spec.ts';` line.
- [x] 2.2 Edit `router.ts`: remove the `if (command === 'spec') { ... }` branch covering `propose`, `apply`, `archive`, missing-subcommand, and unknown-subcommand handling.
- [x] 2.3 Edit `router.ts`: remove the top-level `apply`, `propose`, and `archive` command branches (the shorthand routing).
- [x] 2.4 Edit `commands/help.ts`: remove the `spec` command help block (around lines 17-26) and the `propose`, `apply`, `archive` help entries (around lines 28-46).
- [x] 2.5 Edit `commands/help.ts`: remove the `spec propose`, `spec apply`, `spec archive`, `propose`, `apply`, `archive` listItem lines from the help summary (around lines 176-181).

## 3. Remove tests

- [x] 3.1 Delete `spec-propose.test.ts` entirely.
- [x] 3.2 Delete `spec-apply.test.ts` entirely.
- [x] 3.3 Delete `spec-archive.test.ts` entirely.
- [x] 3.4 Edit `integration.test.ts` to remove all `describe`/`it` blocks that exercise `af spec propose`, `af spec apply`, `af spec archive`, `af propose`, `af apply`, or `af archive`. Leave unrelated coverage intact.
- [x] 3.5 Edit `utils/proposal.test.ts` to remove cases that exercise `extractProposalTitle` and `getLatestChangeId`. If the file becomes empty after trimming, delete it.

## 4. Update documentation

- [x] 4.1 Edit `CLAUDE.md`: remove the entire "OpenSpec Commands with Auto-Commit" section, including the `af spec propose`, `af spec archive`, and `af spec apply` subsections and the "Auto-Commit Behavior" subsection.
- [x] 4.2 Edit `CLAUDE.md`: remove the "Configurable Agent Command" section, since `ARTIFEX_AGENT` and `getAgentCommand()` are being deleted.
- [x] 4.3 Edit `README.md`: remove the "Propose OpenSpec Changes", "Archive OpenSpec Changes", and "Apply OpenSpec Changes" sections.
- [x] 4.4 Edit `README.md`: remove the "ARTIFEX_AGENT Environment Variable" subsection from the Configuration section.
- [x] 4.5 Grep the rest of the repo (excluding `openspec/changes/archive/` and `openspec/specs/` directories that this change is already removing) for any lingering references to the removed commands or `ARTIFEX_AGENT` and update them.

## 5. Verify

- [x] 5.1 Run `bun run format` to format any edited files.
- [x] 5.2 Run `bun run lint` and fix any new violations introduced by the deletions (likely unused imports).
- [x] 5.3 Run `bun run spell:check` and add any new words to `.cspell.json` if needed.
- [x] 5.4 Run `bun test` and confirm all remaining tests pass.
- [x] 5.5 Run `openspec validate remove-spec-subcommands --strict` and resolve any validation errors.
- [x] 5.6 Run `./af help` and confirm the help output no longer mentions `spec`, `propose`, `apply`, or `archive` as commands.
- [x] 5.7 Run `./af spec propose foo` and `./af propose foo` and confirm both produce the standard "Unknown command" error and exit code 1.
- [x] 5.8 Confirm `utils/claude.ts` no longer exists and `grep -r ARTIFEX_AGENT` returns no hits in non-archive paths.
