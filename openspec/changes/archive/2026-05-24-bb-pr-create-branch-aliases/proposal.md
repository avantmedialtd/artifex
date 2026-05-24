# Add `--source`/`--destination` aliases for `--from`/`--to` on `af bb pr create`

## Why

The `af bb pr create` flags `--from` and `--to` name the source and destination branches of the pull request. Other Bitbucket-adjacent tooling (the REST API, `git push`, Bitbucket's own UI) uses the words "source" and "destination", so users — and especially users coming from those tools — reach for `--source` and `--destination` first. Today both attempts silently parse into unused option keys and then fall through to the default branch detection, producing surprising PRs against `main` instead of an error or the intended target.

## What Changes

- `af bb pr create` SHALL accept `--source` and `--src` as aliases of `--from`.
- `af bb pr create` SHALL accept `--destination` and `--dest` as aliases of `--to`.
- Aliases are resolved at parse time so the rest of the command handler is unchanged.
- When both an alias and its canonical flag are passed in the same invocation, the value occurring later on the command line wins (inherent to the existing last-write-wins loop; documented explicitly so behavior is intentional, not accidental).
- The `pr create` help block gains a one-line note listing the accepted aliases; the usage signature is left unchanged to stay readable.

No breaking changes. No new dependencies. Existing `--from` / `--to` invocations behave identically.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `bitbucket-command`: the "Pull request creation" requirement gains scenarios for the new source/destination aliases and for last-write-wins conflict resolution.

## Impact

- `commands/bitbucket.ts`: introduce a parse-time alias map in `parseArgs` and tweak the `pr create` help text.
- `commands/bitbucket.test.ts` (new file): cover alias-to-canonical resolution and conflict precedence. No `commands/bitbucket.test.ts` exists today, so this is a new fixture rather than a touch to an existing suite.
- No changes to `bitbucket/lib/` (the HTTP client is downstream of the parser and sees only normalized values).
- No changes to other commands; the alias map is local to `bitbucket.ts`.
