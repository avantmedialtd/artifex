## Context

`af e2e` runs the suite inside Docker and decides pass/fail from one value:
`e2eExitCode`, the exit code of `docker compose exec -T e2e sh -c "npm run e2e -- … --reporter=./copy-prompt-reporter.ts,html"` (`scripts/e2e_tests.ts:317`). Both the
final banner (lines 380–394) and the function's return value (line 397) branch
solely on `e2eExitCode === 0`.

That exit code is a fragile wire. `docker compose exec -T` faithfully propagates
the inner command's code, but the inner `npm run e2e` belongs to the *target*
project, and an npm script can swallow a non-zero code (a `| tee` pipe, a trailing
`|| true`, or a wrapper that ignores both passthrough args and child status). When
it does, artifex prints "🎉 E2E tests completed successfully!" and returns `0` while
the bundled reporter, in the same output, prints "🎯 1265 passed, 1 failed".
`af stop-hook` gates on this exit code (`commands/stop-hook.ts:85`), so a false green
lets a commit with a red test through the Stop hook.

The key asymmetry: artifex **owns both ends**. `resources/copy-prompt-reporter.ts`
accumulates `this.results = {passed, failed, skipped, timedOut}` across `onTestEnd`,
but its `onEnd` (line 256) returns `void` and persists nothing the runner reads.
The ground truth exists; it is simply discarded.

## Goals / Non-Goals

**Goals:**

- `af e2e` never reports success (banner **or** return code) when tests actually
  failed, regardless of what a downstream npm script does to the exit code.
- The verdict is derived from the reporter's own tally, cross-checked with the exit
  code — both must agree on success.
- The verdict decision is a pure, unit-tested function; the regression
  (exit `0` + `failed: 1` ⇒ FAIL) is locked by a test that needs no Docker.
- `af stop-hook` inherits the corrected exit code with no change of its own.

**Non-Goals:**

- Diagnosing or fixing why a target project's `npm run e2e` swallows its exit code
  (that lives in a separate repo).
- Changing the reporter's human-facing console output.
- Adopting Playwright's built-in `json` reporter (rejected — see Decisions).
- Changing `af stop-hook`'s own logic.

## Decisions

### D1: Persist ground truth as a file artifact, not via the exit code

The reporter writes `e2e-summary.json` (`{passed, failed, timedOut, skipped}` — the
lengths of its existing `this.results` arrays) to the container workspace in `onEnd`.
`scripts/e2e_tests.ts` copies it out with the same `docker compose cp` mechanism
already used for the HTML report, then reads it.

- **Why a file over forcing Playwright's exit code?** A reporter *can* influence
  Playwright's exit status (`onEnd` returning `{ status }`), but that status still
  has to travel back through the very `npm run e2e` wrapper that we have already
  observed swallowing it. A file copied directly out of the container bypasses the
  wrapper entirely — it survives whatever the script does to `$?`.
- **Why the custom reporter over Playwright's `json` reporter?** (Alternative
  considered.) The `json` reporter means a third entry in the reporter chain plus
  `PLAYWRIGHT_JSON_OUTPUT_NAME` env wiring into the container, and it risks polluting
  stdout if misconfigured. The custom reporter is already always injected
  (`e2e_tests.ts:308`) and already holds the counts — four lines in `onEnd` reuse
  what is in hand, with no new chain entry or env propagation.

### D2: Verdict = exit code AND reporter summary must both pass

Extract a pure function:

```
computeVerdict(exitCode: number, summary: Summary | null): { failed: boolean; reason: string }
```

| exitCode | summary        | verdict | reason                                  |
|----------|----------------|---------|-----------------------------------------|
| `0`      | `failed+timedOut === 0` | PASS    | agree: pass                             |
| `≠0`     | any            | FAIL    | runner exited non-zero                  |
| `0`      | `failed+timedOut > 0`   | FAIL    | **reporter found failures (exit code unreliable)** |
| any      | `null` (missing)        | FAIL    | summary missing — cannot verify         |

A run passes **iff** `exitCode === 0` AND a summary is present AND
`failed + timedOut === 0`. Failure of either signal fails the run.

- **Why fold `timedOut` into failure?** A timed-out test is a non-pass; the reporter
  tracks it separately, so the verdict must include it explicitly rather than rely on
  it surfacing through `failed`.

### D3: Missing summary is fail-closed

The reporter is appended to the command unconditionally (`e2e_tests.ts:308`), so a
run that produces no `e2e-summary.json` is anomalous — the reporter crashed, never
ran, or the copy failed. A commit-gating hook must not pass on absent evidence, so a
missing summary is treated as failure with a message stating the cross-check could
not be performed.

- **Alternative considered:** warn and fall back to the raw exit code. Rejected — it
  re-opens the exact crack this change closes (a swallowed exit code with no summary
  would pass).

### D4: The verdict drives both the banner and the return value

`computeVerdict(...).failed` replaces the `e2eExitCode === 0` test at the banner
(lines 380–394) and the `return e2eExitCode` at line 397 (which becomes
`return failed ? 1 : 0`). Fixing only the banner would leave `af stop-hook` — which
reads the return code — still deceived.

## Risks / Trade-offs

- **Stale `e2e-summary.json` from a previous run is copied/read** → The runner
  removes `./e2e-summary.json` before the copy (mirroring the existing
  `fs.rmSync('./playwright-report', …)` cleanup at lines 337–338), so a copy failure
  cannot silently surface yesterday's green.
- **Reporter `onEnd` write throws (e.g. read-only workspace)** → wrap the write so a
  reporter failure does not abort the Playwright process; the missing file then
  triggers the fail-closed path (D3) rather than a false pass.
- **Malformed/partial JSON** → parse defensively; treat unparseable summary as
  missing (fail-closed).
- **Legitimate runs with no test outcomes** (e.g. a passthrough invocation that lists
  tests) would now fail-closed. Accepted: the default and documented use is running
  the suite, where the reporter always emits a summary; the safety of the
  commit-gating hook outweighs this edge case.
