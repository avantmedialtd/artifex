## Context

`af bb` wraps a narrow slice of the Bitbucket Cloud REST API (`https://api.bitbucket.org/2.0`): pull requests, pipelines, and `members`. The client (`bitbucket/lib/client.ts`) already provides the three primitives this change needs — `bbRequest<T>` (JSON), `bbRequestText` (raw text for diffs/logs/patches), and `bbPaginate<T>` (drains the `{values, next}` cursor) — plus target resolution (`--workspace`/`--repo` → `af.json` → git origin) and a `--json` convention on every subcommand. `getRepository()` already exists but is only called internally to resolve the target.

This change adds a **read-only** inspection tier on top of that existing infrastructure. It introduces no new auth, no new dependencies, and no mutating endpoints.

## Goals / Non-Goals

**Goals:**

- Let a user or agent inspect a remote repo's state — identity, repos, branches, tags, commits, file contents, diffs, and PR gate/review state — **without a local clone**.
- Reuse the existing client primitives; keep the new code thin (functions + formatters + routing).
- Uniform shape with the rest of `af bb`: target resolution, `--json` everywhere, exit 0 on success / 1 on error.

**Non-Goals:**

- Any mutation (write files, create branches/tags, publish statuses, change PRs). Explicitly deferred to later tiers.
- Exit-code gating on PR status (see Decisions — kept informational; gating is a later refinement).
- Replacing `git`. These commands read the *remote's* authoritative state; they are complementary to a local checkout, not a substitute for one.

## Decisions

### Endpoint map

| Command | Method + path (under `/2.0`) | Client primitive |
| --- | --- | --- |
| `whoami` | `GET /user` | `bbRequest` |
| `repo list` | `GET /repositories/{ws}` (`?q`, `?role`, `?sort`) | `bbPaginate` |
| `repo get` | `GET /repositories/{ws}/{repo}` (existing `getRepository`) | `bbRequest` |
| `branch list` / `branch get` | `GET …/refs/branches[/{name}]` (`?q`, `?sort`) | `bbPaginate` / `bbRequest` |
| `tag list` / `tag get` | `GET …/refs/tags[/{name}]` (`?q`, `?sort`) | `bbPaginate` / `bbRequest` |
| `commit list` | `GET …/commits[/{branch}]` (`?include`, `?exclude`) | `bbPaginate` (capped) |
| `commit get <sha>` | `GET …/commit/{sha}`; `…/diff/{sha}`; `…/diffstat/{sha}`; `…/patch/{sha}` | `bbRequest` / `bbRequestText` |
| `src read <path>` | `GET …/src/{ref}/{path}` (raw) | `bbRequestText` |
| `src ls [path]` | `GET …/src/{ref}/{path}/` (`?max_depth`) | `bbPaginate` |
| `diff <spec>` | `GET …/diff/{spec}`; `…/diffstat/{spec}` | `bbRequestText` / `bbRequest` |
| `pr activity <id>` | `GET …/pullrequests/{id}/activity` | `bbPaginate` (capped) |
| `pr status <id>` | `GET …/pullrequests/{id}/statuses` | `bbPaginate` |
| `pr reviewers <id>` | (derived from existing `getPullRequest().participants[]`) | — |

### Raw text vs JSON

Diff, diffstat-as-patch, raw patch, and file content come back as **plain text**, not JSON — they route through `bbRequestText` (the same path `pr diff` already uses) and stream to stdout verbatim. Structured `diffstat` (per-file add/remove counts) is JSON via `bbRequest`. Under `--json`, text payloads are still emitted as text (there is no JSON form); only structured responses are re-serialized.

### `pr reviewers` reuses the PR object, no new endpoint

Bitbucket has no dedicated "list reviewers" GET; reviewer + approval state lives in the PR's `participants[]` (role `REVIEWER`/`PARTICIPANT`, `approved`, `state`). `pr reviewers` calls the existing `getPullRequest` and renders/filters `participants` — `--pending` shows those who haven't approved. This avoids a redundant fetch path.

### `pr status` is informational (exit 0)

`…/pullrequests/{id}/statuses` returns the build/commit statuses attached across the PR's commits. `pr status` renders them (key, state, name, url) and **always exits 0** — it is an inspection command. Merge-gate scripting is supported via `--json` + a check on `state`. Mirroring `af sonar pr`'s non-zero-on-failure exit is noted as a *later* refinement so the whole read tier keeps uniform exit semantics and zero side effects.

### Default-ref resolution

When `--ref` is omitted, `src read`, `src ls`, and `commit list` default to the repository's **main branch**, lazily resolved with one `getRepository()` call (only when no ref is supplied). This matches how `pr create` already defaults the target to the repo main branch.

### Pagination bounds

`repo list`, `branch list`, `tag list` drain all pages like the existing `pr list` (bounded result sets in practice). `commit list` and `pr activity` are effectively unbounded histories, so they take `--limit` (default 25) and stop draining once the limit is reached — preventing an accidental full-history fetch.

### Path / revspec encoding

- `src/{ref}/{path}`: the **ref** is one URL segment (percent-encoded); the **path** keeps its slashes (joined raw, each segment encoded). A trailing `/` requests a directory listing.
- `diff/{spec}` and `diffstat/{spec}`: the spec (`main..feature`, `A...B`, or a bare sha) is a **single** segment and is percent-encoded whole — the `..`/`...` belong to Bitbucket's revspec grammar, not the URL structure.

## Risks / Trade-offs

- **`whoami` token scope** — `GET /user` needs the token's *Account: Read* scope. On a 403 we surface a clear message pointing at the token-scope docs rather than a bare error.
- **Large text payloads** — a big file, diff, or patch streams through `bbRequestText` to stdout; acceptable (same as today's `pr diff`), but `src read` on a binary file is meaningless — we note `--json` won't help and leave byte-faithful passthrough.
- **`--query` passthrough** — BBQL `?q` strings are forwarded verbatim; a malformed query yields a Bitbucket 400 which we surface as the error message (we don't try to validate BBQL client-side).
- **`src ls --recursive`** — implemented via `max_depth`; a very deep tree can be large. Default is a single level; recursion is opt-in.
- **PR statuses span commits** — the "gate" can include statuses on multiple commits of the PR; we render all and group by commit so the view isn't misleadingly singular.
