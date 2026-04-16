## Context

The `setup` command ships a bundle of Claude configuration files under `setup/.claude/` that users can copy into `~/.claude/` with `af setup`. Today that bundle contains a `skills/pm/` subtree (a `SKILL.md` plus four templates) that is out of scope for `af` and should stop being distributed.

Files in `setup/` are discovered at build time by `scripts/generate-setup-manifest.ts`, which scans the directory and emits `generated/setup-manifest.ts` containing Bun `{ type: "file" }` imports. The compiled binary embeds these files directly. Removing files from `setup/` and regenerating the manifest is sufficient to remove them from both development and compiled execution.

The `setup-command` spec has one scenario (**Nested directory copying**) that references `setup/.claude/skills/pm/SKILL.md` as its concrete example. That file path will no longer exist, and — more structurally — there will be no nested subtree left in the bundle at all, so the scenario cannot point to any real file post-deletion.

## Goals / Non-Goals

**Goals:**

- Stop distributing the `pm` skill via `af setup`.
- Keep the `setup-command` spec accurate and free of dangling references.
- Preserve the **Directory Structure Preservation** requirement itself — the CLI's nested-copy behavior is still valid and exercised by unit tests, even if no bundled file demonstrates it.

**Non-Goals:**

- Uninstalling `~/.claude/skills/pm/` from existing user machines. Users who already ran `af setup` keep whatever they have on disk.
- Introducing a replacement skill or a new nested example elsewhere in `setup/`.
- Changing the setup command's code, routing, or test suite.

## Decisions

**Decision 1: Delete both `setup/.claude/skills/pm/` and the now-empty `setup/.claude/skills/` parent.**

Alternatives considered:

- _Leave `setup/.claude/skills/` as an empty placeholder for future skills._ Rejected: empty directories are noise, and the manifest generator has no reason to care about a directory with zero files. If a future skill is added, its parent directory will be re-created at that time.

**Decision 2: Rewrite the **Nested directory copying** scenario to use a hypothetical file path rather than drop the scenario.**

The user confirmed in exploration that dropping the scenario entirely was also on the table. Keeping it — with wording like "WHEN setup contains a file at a nested path such as `<subdir>/<file>.md`" — preserves the spec's coverage of the directory-preservation requirement without pretending a concrete example still exists in the bundle. Dropping it would silently weaken the spec even though the underlying behavior is unchanged.

Alternatives considered:

- _Drop the scenario entirely._ Rejected: the requirement itself is still valid, and removing its only scenario would break the spec-level invariant that every requirement has at least one scenario.
- _Introduce a new nested file elsewhere in `setup/` solely to keep the example concrete._ Rejected: adding contrived content just to satisfy a scenario is worse than a hypothetical example.

**Decision 3: Let the build-time manifest generator handle `generated/setup-manifest.ts` updates rather than editing it by hand.**

`bun run generate:manifest` is already the supported way to update the manifest and runs automatically during `bun run compile`. Hand-editing the generated file would be redundant and error-prone.

## Risks / Trade-offs

- **[Risk]** A stale `~/.claude/skills/pm/` on a user's machine could still be loaded by Claude Code if they previously ran `af setup`. → **Mitigation:** accepted and out of scope; users can remove it manually if they care. Documented as a non-goal so expectations are clear.
- **[Risk]** The rewritten scenario uses a hypothetical path, which reads slightly weaker than a concrete example. → **Mitigation:** the scenario's job is to describe behavior, not to assert the presence of a specific file; phrasing it hypothetically is honest about the bundle's post-removal state.
- **[Risk]** If the manifest generator behaves unexpectedly on an empty `setup/.claude/skills/` parent, the build could fail. → **Mitigation:** deleting the parent directory along with `pm/` avoids the edge case entirely. Verified by re-running `bun run generate:manifest` and `bun run compile` after deletion.
