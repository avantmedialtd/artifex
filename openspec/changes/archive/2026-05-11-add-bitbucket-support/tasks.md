## 1. Discovery — verify undocumented behavior

- [x] 1.1 Run `curl -u "$ATLASSIAN_EMAIL:$ATLASSIAN_API_TOKEN" https://api.bitbucket.org/2.0/user` against the sandbox account; confirm 200 + user JSON. If it fails, stop and revisit auth design. **Result: 401. Atlassian tokens scoped for Jira are not accepted by Bitbucket Cloud. Pivoted to dedicated `BITBUCKET_USERNAME` + `BITBUCKET_API_TOKEN` env vars; auth shape remains Basic email:token.**
- [x] 1.2 In the sandbox repo, create a PR via UI; create a global task on it via UI; `GET /pullrequests/{id}/tasks/{tid}` and capture the response shape verbatim. **Verified: standalone task POST `{content:{raw}}` returns `{id, state, content, created_on, updated_on, resolved_on, resolved_by, pending, creator, links}`.**
- [x] 1.3 PUT the task with `{state: "RESOLVED"}` and confirm it flips. Then PUT with `{state: "UNRESOLVED"}`. Record the exact body shape that worked. **Verified against avantmedialtd/sandbox PR#1: `PUT /tasks/{tid}` with `{"state":"RESOLVED"}` → 200, `resolved_on` populated; `{"state":"UNRESOLVED"}` → 200, `resolved_on` cleared.**
- [x] 1.4 In the sandbox PR, create a task linked to a comment via UI; GET it and record the field name(s) that link the task to its comment (`comment.id`, `comment_id`, etc.). Record the exact create-body shape that reproduces this when POSTed. **Verified: POST with `{content:{raw}, comment:{id:<cid>}}` → 201; response includes `comment: {id, links}` field on the task.**
- [x] 1.5 Document the verified body shapes for resolve and comment-linking in a code comment block scoped to `bitbucket/lib/client.ts` (added later); cite the discovery commit so future readers can find the source.

## 2. Shared HTTP layer

- [x] 2.1 Add `requestText(url, options)` to `atlassian/lib/request.ts` reusing `getAuthHeader()` and the same error-parsing logic as `request<T>()`.
- [x] 2.2 Add `paginate<T>(url)` async-iterable helper to `atlassian/lib/request.ts`; follows `next` until absent, yields each `value`.
- [x] 2.3 Write unit tests for `requestText` (success, non-2xx error path).
- [x] 2.4 Write unit tests for `paginate` (single page, multi-page, empty page, auth header passed through).

## 3. Bitbucket library — types and config

- [x] 3.1 Create `bitbucket/lib/types.ts` with response shapes for PR, Comment, Task, Pipeline, PipelineStep, Member.
- [x] 3.2 Create `bitbucket/lib/config.ts` with `resolveTarget()` implementing the 3-layer workspace/repo resolution (flags → `af.json` → git remote).
- [x] 3.3 Implement git-remote parsing: shell out to `git remote get-url origin`, regex-match `bitbucket.org[:/](\w+)/([\w.-]+?)(\.git)?$`, return `{workspace, repo}` or null.
- [x] 3.4 Add `bitbucket: { workspace, repo }` to the af.json type/loader (wherever existing config is loaded — check `commands/` for the precedent).
- [x] 3.5 Write tests for `resolveTarget` covering all four resolution branches and the failure case.

## 4. Bitbucket library — read-side client

- [x] 4.1 Implement `listPullRequests(opts)` using `paginate`, with `state` and `q` query params for author filter.
- [x] 4.2 Implement `getPullRequest(id)`.
- [x] 4.3 Implement `getPullRequestDiff(id)` using `requestText`.
- [x] 4.4 Implement `listComments(prId)`, `getComment(prId, cid)`.
- [x] 4.5 Implement `listTasks(prId)`.
- [x] 4.6 Implement `listPipelines(opts)` with branch and status filters; default sort `-created_on`.
- [x] 4.7 Implement `getPipeline(uuidOrNumber)`.
- [x] 4.8 Implement `listSteps(pipelineUuid)`.
- [x] 4.9 Implement `getStepLog(pipelineUuid, stepUuid)` using `requestText`.
- [x] 4.10 Implement `listMembers(opts)` with optional `q` query param.

## 5. Bitbucket library — write-side client

- [x] 5.1 Implement `createPullRequest({title, source, destination, description, reviewers, draft})`. Source defaults to current branch via `git rev-parse --abbrev-ref HEAD`; destination defaults to `mainbranch.name` from a `getRepository()` lookup.
- [x] 5.2 Implement `updatePullRequest(id, patch)` (title, description, reviewers).
- [x] 5.3 Implement `approvePullRequest(id)`, `unapprovePullRequest(id)`, `requestChangesPullRequest(id)`.
- [x] 5.4 Implement `mergePullRequest(id, {strategy, closeSource})`.
- [x] 5.5 Implement `declinePullRequest(id)`.
- [x] 5.6 Implement `addComment(prId, {body, inline?, parent?})` with the body-shape branching captured in tests.
- [x] 5.7 Implement `updateComment(prId, cid, body)`, `deleteComment(prId, cid)`.
- [x] 5.8 Implement `addTask(prId, {body, onCommentId?})` using the body shape verified in 1.4.
- [x] 5.9 Implement `updateTask(prId, tid, {body?, resolved?})` using the state-field shape verified in 1.3.
- [x] 5.10 Implement `deleteTask(prId, tid)`.
- [x] 5.11 Implement `triggerPipeline({branch?, commit?, custom?, variables?})` building the `target` body for branch / commit / custom-on-branch cases.
- [x] 5.12 Implement `stopPipeline(uuid)`.

## 6. Bitbucket library — formatters

- [x] 6.1 Implement `formatPullRequestList(prs)` — table with id, title, author, state, branches, updated.
- [x] 6.2 Implement `formatPullRequest(pr)` — full single-PR view including reviewers and approval state.
- [x] 6.3 Implement `formatCommentList(comments)` — flat list with reply indentation derived from `parent.id`, and inline anchor displayed for inline comments.
- [x] 6.4 Implement `formatTaskList(tasks)` — checkbox-style with id, body, resolved/unresolved, linked-comment id.
- [x] 6.5 Implement `formatPipelineList(pipelines)` — table with build number, branch, state, duration, created_on.
- [x] 6.6 Implement `formatPipeline(pipeline)` — full single-pipeline view including target.
- [x] 6.7 Implement `formatStepList(steps)` — table with name, state, duration.
- [x] 6.8 Implement `formatMembers(members)` — table with display name, username, account id.

## 7. Command handler — argv parsing and dispatch

- [x] 7.1 Create `commands/bitbucket.ts` with the argv parser (mirror the structure of `commands/jira.ts`).
- [x] 7.2 Wire `bitbucket` and `bb` in `router.ts` to dispatch to the same handler.
- [x] 7.3 Implement `--json` mode plumbing: when set, emit `JSON.stringify(data, null, 2)` instead of calling formatters; never write human text to stdout when JSON is on.
- [x] 7.4 Implement the body-shape decision logic in `pr comment add` (general / inline / reply / inline-reply) based on which flags are present, with mutual-exclusion checks for `--body` vs `--body-file`.
- [x] 7.5 Implement the resolved/unresolved mutual exclusion check in `pr task update`.

## 8. Command handler — subcommand handlers

- [x] 8.1 Wire `pr list` → `pr get` → `pr diff` → `pr create` → `pr update` → `pr approve` → `pr unapprove` → `pr request-changes` → `pr merge` → `pr decline`.
- [x] 8.2 Wire `pr comment list` → `comment get` → `comment add` → `comment update` → `comment delete`.
- [x] 8.3 Wire `pr task list` → `task add` → `task update` → `task delete`.
- [x] 8.4 Wire `pipeline list` → `pipeline get` → `pipeline trigger` → `pipeline stop` → `pipeline steps` → `pipeline logs` (one-shot).
- [x] 8.5 Implement `pipeline logs --follow`: poll `getStepLog` every 2 seconds, emit only new bytes since previous fetch (track via accumulated string length), stop when `step.state` is `SUCCESSFUL`/`FAILED`/`STOPPED`/`ERROR`.
- [x] 8.6 Wire `members [--query Q]`.

## 9. Help text and command discovery

- [x] 9.1 Add a `bitbucket` (and `bb` alias) section to `commands/help.ts` listing the subcommand surface.
- [x] 9.2 Verify `af` with no arguments lists `bitbucket` alongside `jira` and `confluence`.
- [x] 9.3 Verify `af bitbucket` with no further args prints the bitbucket help.

## 10. Documentation

- [x] 10.1 Add a "Bitbucket Command" section to `CLAUDE.md` mirroring the existing "Confluence Command" section, including the env var note (reuses `ATLASSIAN_*`/`JIRA_*`), the `af.json` config example, and the workspace/repo resolution order.
- [x] 10.2 Add a brief note in the "Atlassian Configuration" section that `requestText()` and `paginate()` now exist in `atlassian/lib/request.ts`.

## 11. Tests

- [x] 11.1 Unit tests for the `pr comment add` body-shape branching (general / inline / reply / inline-reply / mutual exclusion).
- [x] 11.2 Unit tests for the `pr task update` resolve/unresolve mutual exclusion.
- [x] 11.3 Unit tests for git-remote URL parsing (HTTPS, SSH, with and without `.git`).
- [x] 11.4 Unit tests for the `target` body construction in `triggerPipeline` (branch / commit / custom).
- [x] 11.5 Unit tests for formatters (snapshot-style or specific-line assertions).
- [x] 11.6 Integration smoke test against the sandbox repo: list PRs, get one, list its comments, list pipelines. **All verified against avantmedialtd/sandbox: pr list/get/diff/comment list (with reply indentation)/task list (with linked-comment)/task update --resolved/--unresolved/--resolved+--unresolved mutex/members --query/pipeline list (empty, no error)/--json mode (raw API response).**

## 12. Verification

- [x] 12.1 `bun run format:check` passes.
- [x] 12.2 `bun run lint` passes.
- [x] 12.3 `bun run spell:check` passes (add `bitbucket`, `pullrequest(s)`, `account_id`, etc. to the cspell dictionary if needed).
- [x] 12.4 `bun run test` passes.
- [x] 12.5 Manually exercise each subcommand against the sandbox repo at least once with `--json` and without. **Exercised: pr list / pr get / pr diff / pr comment add / pr task add (linked & standalone) / pr task update (resolved/unresolved/mutex error) / pr decline / members --query / pipeline list / --json output. Not exercised against the sandbox (no triggerable pipeline or running step): pr approve/merge, pipeline trigger/stop/logs/--follow.**
