# Add a read-only inspection surface to `af bb`: repos, refs, commits, source, and PR gate state

## Why

`af bb` today exposes three islands of the Bitbucket Cloud REST API — pull requests, pipelines, and a workspace-member lookup. An audit of the full API (284 endpoints across 15 domains) found 276 entirely uncovered. The single most consequential gap — given af's positioning as a service-CLI substrate for AI agents and CI/release automation — is that **af cannot read the state of a remote repository without a local clone**: it can open and merge a PR, but cannot list the branches that PR runs between, read a file at a ref, enumerate recent commits, inspect a commit's diff, or answer "is this PR's gate green?".

This forces every "orient yourself in the repo" workflow to shell out to raw `git` (which only sees the local clone, not the remote's authoritative state) or drop into the Bitbucket web UI. For an autonomous agent loop — read repo → make change → commit → open PR → check gate → merge — af currently owns only the two ends (`pr create`, `pr merge`); the read steps in between are missing.

The read surface is also the cheapest tier to build, because the plumbing already exists. `bbPaginate` handles the `{values, next}` cursor shape, `bbRequestText` already carries raw diffs/logs/patches, and `getRepository()` is already written and used internally — it just isn't exposed as a command.

## What Changes

Add a focused, **read-only** inspection surface to `af bb`, mirroring how `af sonar` is positioned (read-only inspection, exit-code aware). No mutating operations are introduced — those are deferred to later tiers. Every new subcommand supports `--json`.

- **Identity** — `af bb whoami` (`GET /user`): report the account the token authenticates as, including the account id needed for reviewer/approve operations (the analogue of how `af jira` resolves `/myself`).
- **Repositories** — `af bb repo list` (workspace repos, with `--query` BBQL / `--role` / `--sort`) and `af bb repo get` (expose the existing internal `getRepository`).
- **Refs** — `af bb branch list` / `branch get <name>` and `af bb tag list` / `tag get <name>`, with filter + sort.
- **Commits** — `af bb commit list` (by `--branch`, `--include` / `--exclude` revspec range, `--limit`) and `af bb commit get <sha>` with `--diff` / `--diffstat` / `--patch`.
- **Source** — `af bb src read <path> [--ref]` (raw file content at a ref) and `af bb src ls [path] [--ref] [--recursive]` (browse a directory).
- **Arbitrary diff** — `af bb diff <spec> [--stat] [--patch]` over the `/diff/{spec}` and `/diffstat/{spec}` revspec endpoints (strictly more general than `pr diff`: handles `A..B` and `A...B`).
- **PR gate / review read** — `af bb pr activity <id>` (chronological feed), `af bb pr status <id>` (aggregated build/commit statuses — "is it green?"), and `af bb pr reviewers <id>` (participants + approval state).

## Capabilities

### Modified Capabilities

- `bitbucket-command`: add requirements for the read-only inspection subcommands above (identity, repository read, refs read, commit read, source read, arbitrary diff, and PR gate/review read). No existing requirement changes behavior — this is purely additive.

## Impact

- **Code**: `bitbucket/lib/client.ts` (new read functions reusing `bbRequest` / `bbRequestText` / `bbPaginate`), `bitbucket/lib/types.ts` (response types for repos, refs, commits, statuses, activity, src entries), `bitbucket/lib/formatters.ts` (table + detail renderers), `commands/bitbucket.ts` (new subcommand routing: `whoami`, `repo`, `branch`, `tag`, `commit`, `src`, `diff`, plus the new `pr` actions), `commands/help.ts` (examples).
- **Docs**: `README.md` and `CLAUDE.md` Bitbucket sections; `.cspell.json` for new terms (e.g. `revspec`, `diffstat`, `whoami`, `BBQL`).
- **Tests**: `bitbucket/lib/client.test.ts` + `formatters.test.ts` (exact URL shapes, automatic pagination, raw-text passthrough for diff/file content, rendering).
- **No new dependencies. No auth changes** (reuses the existing Bitbucket workspace token). **No mutating endpoints** — every command is a GET.
- **Out of scope (later tiers)**: write-to-repo (`src commit`, branch/tag create), `status set` (publish a build status from external CI), branch restrictions, default reviewers, webhooks, pipeline config/variables, deployments, Code Insights, the native issue tracker, and snippets.
