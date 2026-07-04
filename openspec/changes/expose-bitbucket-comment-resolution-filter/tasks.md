## 1. Comment thread filtering helper

- [x] 1.1 Add a `ResolutionFilter` type (`'resolved' | 'unresolved' | undefined`) shared by comment and task filtering in `bitbucket/lib/`.
- [x] 1.2 Implement a pure `filterCommentsByResolution(comments, filter)` in `bitbucket/lib/` that returns the flat comment array unchanged when `filter` is undefined, and otherwise walks each comment's `parent.id` chain to its top-level ancestor, keeps the comment iff the ancestor's `resolution` presence matches the filter, and preserves replies of retained threads.
- [x] 1.3 Make the ancestor walk defensive: bound it against cyclic/missing `parent` references (track visited ids or cap depth) and treat the nearest reachable comment as the root.
- [x] 1.4 Unit-test the helper: resolved root keeps its replies; open root keeps its replies; `--resolved` drops open threads and vice versa; deeper nested replies resolve to the top-level root; mixed thread set; deleted root still filters by its resolution; undefined filter is a no-op passthrough.

## 2. Wire filtering into `comment list`

- [x] 2.1 In `commands/bitbucket.ts`, in the `comment list` case, read `--resolved` / `--unresolved`, error with exit 1 when both are set (reuse the existing mutual-exclusivity message pattern), and map to a `ResolutionFilter`.
- [x] 2.2 Apply `filterCommentsByResolution` to the fetched comments before the `json ? … : fmt.formatCommentList(…)` branch so `--json` and the human view both reflect the filter.

## 3. Wire filtering into `task list`

- [x] 3.1 In the `task list` case, read `--resolved` / `--unresolved` with the same mutual-exclusivity guard.
- [x] 3.2 Filter the fetched tasks by `state` (`RESOLVED` / `UNRESOLVED`) before the output branch so `--json` reflects the filter.

## 4. Tests for the command surface

- [x] 4.1 Add command-level tests for `comment list --resolved` / `--unresolved` (human + `--json`) asserting only matching threads (with their replies) are emitted.
- [x] 4.2 Add command-level tests for `task list --resolved` / `--unresolved` (human + `--json`).
- [x] 4.3 Add tests asserting `--resolved --unresolved` on each of `comment list` and `task list` prints an error and exits 1.

## 5. Documentation

- [x] 5.1 Update the inline `pr comment list` and `pr task list` help text in `commands/bitbucket.ts` to document the new `--resolved` / `--unresolved` filter flags.
- [x] 5.2 Update the Bitbucket Command section of `CLAUDE.md` to show the filter flags on `af bb pr comment list` and `af bb pr task list`.

## 6. Verification

- [x] 6.1 Run `bun run test`, `bun run lint:check`, `bun run format:check`, and `bun run spell:check`; fix any failures.
