## 1. Types and client primitives

- [ ] 1.1 Add response types to `bitbucket/lib/types.ts`: `BitbucketAccount` (whoami), `BitbucketRef`/`BitbucketBranch`/`BitbucketTag`, `BitbucketCommit`, `BitbucketDiffStat`, `BitbucketCommitStatus`, `BitbucketActivityEntry`, `BitbucketSrcEntry` (commit_file vs commit_directory).
- [ ] 1.2 Add `getCurrentUser()` in `bitbucket/lib/client.ts` → `GET /user` (via `bbRequest`); map 403 to a clear "token needs Account: Read scope" error.
- [ ] 1.3 Add `listRepositories(workspace, {query, role, sort})` → `GET /repositories/{ws}` draining `bbPaginate`; expose the existing `getRepository` through the command layer (no new client fn needed).
- [ ] 1.4 Add `listBranches`/`getBranch` and `listTags`/`getTag` → `…/refs/branches[/{name}]`, `…/refs/tags[/{name}]` with `q`/`sort` passthrough.
- [ ] 1.5 Add `listCommits({branch, include, exclude, limit})` → `…/commits[/{branch}]`, stopping `bbPaginate` once `limit` (default 25) is reached.
- [ ] 1.6 Add `getCommit(sha)` (`bbRequest`) plus `getCommitDiff`/`getCommitPatch` (`bbRequestText`) and `getCommitDiffStat` (`bbRequest`) → `…/commit/{sha}`, `…/diff|patch|diffstat/{sha}`.
- [ ] 1.7 Add `readSource(path, ref)` (`bbRequestText`) and `browseSource(path, ref, {recursive})` (`bbPaginate`) → `…/src/{ref}/{path}` with correct ref-segment vs path-segment encoding; lazily resolve the main branch when `ref` is omitted.
- [ ] 1.8 Add `getDiff(spec)` (`bbRequestText`) and `getDiffStat(spec)` (`bbRequest`) → `…/diff/{spec}`, `…/diffstat/{spec}` with the spec percent-encoded as a single segment.
- [ ] 1.9 Add `listPullRequestActivity(id, {limit})` (`bbPaginate`, capped) and `listPullRequestStatuses(id)` (`bbPaginate`) → `…/pullrequests/{id}/activity`, `…/pullrequests/{id}/statuses`.

## 2. Formatters

- [ ] 2.1 Add renderers in `bitbucket/lib/formatters.ts`: account (whoami), repository list + single repo, branch/tag list + single, commit list + single commit, diffstat, src directory listing, PR activity feed, PR statuses (grouped by commit), PR reviewers (role + approval state, `--pending` filter).
- [ ] 2.2 Keep raw-text payloads (file content, diff, patch) as verbatim stdout passthrough — no reformatting under `--json`.

## 3. Command routing

- [ ] 3.1 In `commands/bitbucket.ts`, add top-level subcommands: `whoami`, `repo` (`list`/`get`), `branch` (`list`/`get`), `tag` (`list`/`get`), `commit` (`list`/`get`), `src` (`read`/`ls`), `diff`.
- [ ] 3.2 Extend the existing `pr` action switch with `activity`, `status`, and `reviewers`.
- [ ] 3.3 Parse the new options: `--query`, `--role`, `--sort`, `--branch`, `--include`, `--exclude`, `--limit`, `--ref`, `--recursive`, `--diff`/`--diffstat`/`--patch`, `--stat`, `--pending`. Wire `--json` for every new command. Ensure all exit `0`/`1` (no exit-code gating on `pr status`).

## 4. Help and docs

- [ ] 4.1 Add examples to `commands/help.ts` for the new read commands.
- [ ] 4.2 Update the `## Bitbucket Command` section of `README.md` and `CLAUDE.md` with the read-only inspection surface (note: read-only, `--json` everywhere, `whoami` token scope).
- [ ] 4.3 Add new terms to `.cspell.json` (`revspec`, `diffstat`, `whoami`, `BBQL`, and any others) and run `bun run spell:check`.

## 5. Tests

- [ ] 5.1 In `bitbucket/lib/client.test.ts`, assert exact request URLs and query strings for each new function (repos with `q`/`role`/`sort`, refs, commits with `include`/`exclude`/limit cap, commit/diff/patch/diffstat, src read+browse with ref encoding, diff revspec encoding, PR activity/statuses), and that `getCurrentUser` hits `/user`.
- [ ] 5.2 In `bitbucket/lib/formatters.test.ts`, cover each new renderer, including the `pr reviewers --pending` filter and the diffstat/statuses rendering.
- [ ] 5.3 Verify pagination: `commit list`/`pr activity` stop at `--limit`; `repo`/`branch`/`tag` lists drain all pages.

## 6. Gates and finalize

- [ ] 6.1 Run `bun run lint`, `bun run format:check`, `bun run spell:check`, and `bun run test` — all green.
- [ ] 6.2 Run `openspec validate add-bitbucket-read-surface --strict` and confirm it passes.
- [ ] 6.3 Smoke-test against a real repo (`af bb whoami`, `repo get`, `branch list`, `commit list --limit 5`, `src read README.md`, `pr status <id>`) using configured credentials.
