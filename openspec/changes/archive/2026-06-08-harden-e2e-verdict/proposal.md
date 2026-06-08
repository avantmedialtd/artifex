# Harden the `af e2e` Pass/Fail Verdict Against a Lying Exit Code

## Why

`af e2e` decides whether the whole run passed from a single signal — the exit
code of the in-container `npm run e2e` command (`scripts/e2e_tests.ts:317`). When
that exit code comes back `0` despite real failures (a target project's `npm run e2e`
script can swallow it via a pipe, `|| true`, or a wrapper), the runner prints
"✓ All tests passed / 🎉" **and returns `0`** even though the bundled reporter
simultaneously printed "🎯 1265 passed, 1 failed". Because `af stop-hook` gates on
that same exit code (`commands/stop-hook.ts:85`), the Stop-hook safety net silently
passes commits with red E2E tests. artifex already produces the ground truth (the
reporter holds `{passed, failed, skipped, timedOut}`) but throws it away.

## What Changes

- The bundled reporter (`resources/copy-prompt-reporter.ts`) persists its result
  tally to a machine-readable `e2e-summary.json` in the container workspace.
- `scripts/e2e_tests.ts` copies that summary out of the container and derives the
  verdict from it cross-checked against the exit code, instead of from the exit
  code alone. The verdict drives **both** the printed banner and the returned
  exit code.
- A run is reported as **passed only if** the exit code is `0` **and** a summary is
  present **and** it shows zero failures/timeouts; otherwise it fails.
- **Fail-closed:** a missing summary file is treated as a failure (the reporter is
  always injected, so its absence is anomalous and must not pass a commit-gating
  hook).
- The verdict decision is extracted into a pure, unit-tested `computeVerdict`
  function, giving the previously untested runner its first regression test
  (exit `0` + `failed: 1` ⇒ FAIL).

## Capabilities

### New Capabilities
<!-- None — this modifies the behavior of the existing e2e-command capability. -->

### Modified Capabilities
- `e2e-command`: the run verdict is no longer the raw child exit code; it is derived
  from the reporter's ground-truth result summary cross-checked with the exit code,
  and the reporter now emits that summary as a file artifact.

## Impact

- `resources/copy-prompt-reporter.ts` — `onEnd` writes `e2e-summary.json`.
- `scripts/e2e_tests.ts` — copy + read the summary; replace the exit-code-only
  branches at lines 380–394 (banner) and 397 (return value) with `computeVerdict`.
- `af stop-hook` — no code change; it inherits a now-trustworthy exit code.
- No `package.json` `files` allowlist change — `e2e-summary.json` is generated at
  runtime, not shipped.
- Out of scope: why a target project's `npm run e2e` swallows the exit code (lives
  in a separate repo); the Playwright `json`-reporter approach (rejected); changes
  to the reporter's human-facing output.
