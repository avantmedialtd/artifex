## 1. Pre-flight verification

- [x] 1.1 Re-grep the repo for `af commit` and `handleCommit` to confirm the list of affected files matches what the design captured. Flag any new hits not already covered.
- [x] 1.2 Re-grep the repo for `stageAllAndCommit` and `stageAllAndCommitWithTrailers` to confirm `commands/spec.ts` and `utils/git.test.ts` are still the only callers before deletion.
- [x] 1.3 Re-grep the repo for `af commit save` across `setup/`, `.claude/`, `.opencode/`, and `.github/` to catch any stale copies of the workflow slash commands that are not in the four-path list from the design.

## 2. Remove CLI code

- [x] 2.1 Delete `commitForChange`, `handleCommitApply`, `parseTrailer`, and `handleCommitSave` from `commands/spec.ts` (lines 279–405). Also drop the now-unused imports from `utils/git.ts` and `utils/openspec.ts` (`stageAllAndCommit`, `stageAllAndCommitWithTrailers`, `listOngoingChanges` if it has no remaining callers in this file).
- [x] 2.2 Remove the `handleCommitApply` and `handleCommitSave` imports and the entire `if (command === 'commit') { ... }` block from `router.ts`.
- [x] 2.3 Remove the `commit` entry from the help registry in `commands/help.ts`. (Also removed the two `commit save` / `commit [apply] [id]` lines in `showGeneralHelp` which were not visible from the grep and would have left commit visible in `af help`.)
- [x] 2.4 Delete `commit-apply.test.ts`.

## 3. Remove git helpers

- [x] 3.1 Delete `stageAllAndCommit` and `stageAllAndCommitWithTrailers` functions from `utils/git.ts`. (Also removed the orphaned `hasChangesToCommit` helper, whose only caller was the deleted `handleCommitSave`.)
- [x] 3.2 Delete the corresponding `describe('stageAllAndCommit', ...)` block and any related imports from `utils/git.test.ts`.
- [x] 3.3 Run `bun test utils/git.test.ts` and confirm the remaining git tests still pass. (7/7 pass.)

## 4. Rewrite bundled slash commands

- [x] 4.1 Rewrite `setup/.claude/commands/commit-work.md` step 3 to invoke `git add -A && git commit -m "<title>" --trailer "OpenSpec-Id=<openspec-id>"` instead of `af commit save`. Update the "Reference" section at the bottom (remove the `af help commit` hint).
- [x] 4.2 Rewrite `setup/.claude/commands/complete-work.md` lines 25 and 47 to use the same native-git pattern. Preserve the existing trailer set (`Issue=<issue-key>` when available, always `OpenSpec-Id=<change-id>`).
- [x] 4.3 Rewrite `setup/.claude/commands/work-auto.md` lines 104 and 134 to use the same native-git pattern, keeping both `Issue=<issue-key>` and `OpenSpec-Id=<change-id>` trailers.
- [x] 4.4 For each rewritten slash command, make a scratch commit in a throwaway branch and inspect `git log -1 --format=%B` to confirm the message body and trailers match what `af commit save` would have produced (title on line 1, blank line, `OpenSpec-Id: <id>` and any `Issue: <key>` trailer). (Verified in §8 using a throwaway git repo — all four patterns produce byte-correct messages, confirmed by `git interpret-trailers --parse`.)
- [x] 4.5 Check for and update any other in-repo copies of these files found in step 1.3 (e.g., `.claude/commands/`, `.opencode/command/`, `.github/commands/`). (None exist — `.claude/commands/` only contains `opsx/`, `.opencode/command/` only contains `opsx-*` files, `.github/commands/` does not exist.)

## 5. Update specs (in-repo, not delta)

- [x] 5.1 Delete `openspec/specs/commit-command/spec.md`.
- [x] 5.2 Delete `openspec/specs/commit-save-subcommand/spec.md`.
- [x] 5.3 Update `openspec/specs/commit-work-command/spec.md` in place so its scenarios describe the native-git commit step (add the new "Commit is created via native git" scenario from the delta spec, and leave the archive-flow scenarios untouched).
- [x] 5.4 Update `openspec/specs/setup-command/spec.md` lines 137, 147, 156 so the "Commit Work Command" scenarios reference `git add -A && git commit -m "<title>" --trailer "OpenSpec-Id=<id>"` instead of `af commit save`.

## 6. Lock in the removal with tests

- [x] 6.1 Add an `af commit` absence assertion to `integration.test.ts` (modeled on the `af licenses` test added in commit `500514e`): expect `af commit` to exit non-zero with an "Unknown command" style error on stderr.
- [x] 6.2 Add an `af commit save` absence assertion in the same style — a user who types the old subcommand should get a clear unknown-command error, not a silent success.
- [x] 6.3 Verify that `af help` output no longer lists `commit`, `commit save`, or `commit apply`. (Added an integration assertion `should not list commit in general help output`.)

## 7. Validation

- [x] 7.1 Run `bun run format` and `bun run lint` and fix any regressions. (Both clean.)
- [x] 7.2 Run `bun test` and confirm the full suite passes. (Actual command: `bun run test` — 271 pass, 27 skip, 0 fail.)
- [x] 7.3 Run `bun run spell:check` — removing prose may flip the dictionary, though unlikely. (Flagged the word "automated workflows" variant twice in proposal.md and design.md; reworded rather than polluting the dictionary.)
- [x] 7.4 Run `openspec validate --strict remove-af-commit-command` and resolve any violations. (Valid.)
- [x] 7.5 Manually run `af help` and `af help commit` (the latter should report an unknown topic) to confirm the help surface is clean. (`af help` shows no commit entries; `af help commit` prints "Unknown command: commit" and suggests running `af help`.)
- [x] 7.6 Manually run `af commit` and `af commit save "test"` to confirm both produce a clear unknown-command error and a non-zero exit code. (Both emit `Error: Unknown command: commit` and exit 1.)

## 8. Workflow sanity check

- [x] 8.1 On a scratch branch with a trivial change, walk through `/commit-work` end-to-end against the rewritten slash command and confirm the resulting commit has the expected title + `OpenSpec-Id` trailer. (Used a throwaway temp-dir git repo rather than a branch off master so the current working tree stays intact. Verified the rewritten `git add -A && git commit -m "Add User Authentication" --trailer "OpenSpec-Id=add-user-auth"` produces `Add User Authentication\n\nOpenSpec-Id: add-user-auth`.)
- [x] 8.2 On the same scratch branch, walk through `/complete-work` with a fake `Issue=` argument and confirm the commit has both trailers in the expected order. (Verified `git commit -m "Fix login bug" --trailer "Issue=PROJ-123" --trailer "OpenSpec-Id=fix-login-bug"` produces title + blank line + `Issue: PROJ-123` + `OpenSpec-Id: fix-login-bug` in that order. Also tested the no-Issue fallback and the `/work-auto` multi-line continuation style — all four patterns produce byte-correct commits and are parsed as valid trailers by `git interpret-trailers --parse`.)
- [x] 8.3 Clean up the scratch branch (`git reset` or delete) before archiving the change. (Scratch repo was a temp directory, already removed.)
