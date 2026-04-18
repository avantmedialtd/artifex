## Context

Artifex currently ships a bundled set of Claude Code workflow commands under `setup/.claude/commands/` and exposes `af setup` to copy them into the user's `~/.claude/` tree. To make these commands available inside the single-file Bun-compiled binary, the project also runs a build-time step (`scripts/generate-setup-manifest.ts`) that emits `generated/setup-manifest.ts` with `{ type: "file" }` imports, embedding every setup file in the executable. The same manifest happens to also embed `resources/copy-prompt-reporter.ts` for the `af e2e` command.

The workflow commands are now authored in a dedicated skills repo (`avantmedialtd/skills`) and installed via `npx skills add`. That repository handles versioning, updates, and discovery as proper agent skills — a strictly better distribution channel. At the same time, `af` is installed from npm as a Node shim (`./af`) that spawns Bun against the TypeScript source; the compiled binaries under `dist/` are neither referenced by the `bin` entry nor listed in the `files` whitelist. The compile pipeline is effectively orphaned.

## Goals / Non-Goals

**Goals:**
- Remove the `af setup` command and all of its direct dependencies.
- Remove the `bun compile` pipeline and the manifest generator it feeds.
- Keep `af e2e` working: the reporter still needs to reach the Docker container, but via a direct filesystem copy rather than through the embedded-manifest layer.
- Preserve the published npm package's shape (users should `npm install -g @avantmedia/af` and get the same working `af` CLI).

**Non-Goals:**
- Authoring the five migrated skills in `../skills`. That happens in a separate commit in that repository.
- Removing the `dist/` directory from git history (if present, can be cleaned up separately).
- Revisiting the `af` Node shim or the Bun runtime dependency.

## Decisions

### Decision 1: Delete the compile pipeline outright rather than keep it optional

**Choice**: Remove all `compile*` npm scripts, `precompile`, the manifest generator, the generated manifest file, and the `isCompiled()` check paths in `utils/resources.ts`.

**Rationale**: No consumer uses the compiled binary — the npm `bin` entry points at `./af`, the `files` whitelist excludes `dist/`, and the compile scripts reference `main.ts` directly (not via the shim). Keeping a "just in case" path means keeping the manifest generator, the generated file, and two runtime branches in `utils/resources.ts` forever. Deleting is simpler and reversible if anyone ever wants compiled binaries back.

**Alternative considered**: Keep `compile:current` as a developer convenience. Rejected because nothing in the codebase exercises it — it'd be dead code with no guarantee of continuing to work.

### Decision 2: `utils/resources.ts` reads from the filesystem unconditionally

**Choice**: Replace the branch on `isCompiled()` with a direct `copyFileSync(join(projectRoot, 'resources', name), target)`.

**Rationale**: The published npm package ships `resources/` as part of the `files` whitelist, so the file is always present on disk at runtime. Removing the manifest indirection removes an entire class of "what happens in compiled mode" questions from future contributors.

### Decision 3: Drop `e2e.md` without a replacement port

**Choice**: The `setup/.claude/commands/e2e.md` slash command is deleted and not carried forward to the skills repo.

**Rationale**: The skills repo already ships `e2e-testing` (metadata + guidance for E2E workflows), which covers the same surface and more. Porting the existing slash-command file would duplicate. Users who want `/e2e` behavior get it through the `e2e-testing` skill instead.

### Decision 4: Skill authoring happens in the other repo

**Choice**: This OpenSpec change scopes itself to the artifex repository only. The five new skills (`start-work`, `complete-work`, `commit-work`, `work-auto`, `into-worktree`) are authored and committed in `../skills` as independent work.

**Rationale**: Cross-repo changes are hard to review and hard to archive cleanly. Keeping the artifex change self-contained makes the proposal, specs, and tasks auditable without reaching outside this repo.

## Risks / Trade-offs

- **[Users currently depending on `af setup`]** → Call it out in the proposal and in `CLAUDE.md` with the migration path (`npx skills add avantmedialtd/skills`).
- **[Someone wants the compiled binary back later]** → Reintroduce targeted `compile:*` scripts at that time. The manifest generator is not strictly needed — Bun's `{ type: "file" }` imports can be written by hand if resource embedding ever becomes necessary again.
- **[Users on OpenCode]** → `af setup` also copied files to `~/.config/opencode/command/`. OpenCode users lose that convenience and will need to install the workflow skills through the skills repo's OpenCode path (or copy manually). Mentioned in the proposal.
- **[`e2e.md` slash command gap]** → The `e2e-testing` skill in `../skills` has overlapping guidance. Users who type `/e2e` habitually may not hit anything until they install the skill. Acceptable; they still have `af e2e` as the canonical invocation.

## Migration Plan

1. Author the five skills in `../skills` first (separate commit, not part of this change).
2. Land this change: delete setup, delete compile, simplify resources.
3. Publish a new `@avantmedia/af` version. Users who upgrade lose `af setup`; `CLAUDE.md` and the proposal document the alternative.
