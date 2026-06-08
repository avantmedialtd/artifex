## 1. Pure verdict function (testable core)

- [x] 1.1 Define a `Summary` type `{ passed: number; failed: number; timedOut: number; skipped: number }` and export `computeVerdict(exitCode: number, summary: Summary | null): { failed: boolean; reason: string }` from `scripts/e2e_tests.ts` (or a small sibling module it imports).
- [x] 1.2 Implement the truth table: PASS only if `exitCode === 0` AND `summary !== null` AND `summary.failed + summary.timedOut === 0`; FAIL with a descriptive `reason` for non-zero exit, for reporter-reported failures/timeouts, and for a missing summary (fail-closed).

## 2. Reporter emits the summary (E2E-CMD-004)

- [x] 2.1 In `resources/copy-prompt-reporter.ts` `onEnd` (line 256), write `e2e-summary.json` to the workspace with the counts from `this.results` (`passed.length`, `failed.length`, `timedOut.length`, `skipped.length`).
- [x] 2.2 Wrap the write in try/catch so a write failure logs but does not abort the Playwright process (the missing file is handled by the fail-closed verdict).

## 3. Runner reads the summary and applies the verdict (E2E-CMD-001, E2E-CMD-005)

- [x] 3.1 In `scripts/e2e_tests.ts`, before the artifact copy, remove any stale `./e2e-summary.json` (mirroring the existing `fs.rmSync('./playwright-report', …)` cleanup at lines 337–338).
- [x] 3.2 After the report copy (~line 359), `docker compose cp e2e:/workspace/e2e-summary.json ./e2e-summary.json` with `allowFailure: true`.
- [x] 3.3 Read and defensively parse `./e2e-summary.json` into a `Summary | null` (unparseable/missing ⇒ `null`).
- [x] 3.4 Call `computeVerdict(e2eExitCode, summary)` and replace the `e2eExitCode === 0` branch at the summary banner (lines 380–394) so it prints success/failure from `verdict.failed`, surfacing `verdict.reason` on failure (including the missing-summary message).
- [x] 3.5 Replace `return e2eExitCode` (line 397) with `return verdict.failed ? 1 : 0` so `af stop-hook` inherits the corrected code.

## 4. Tests (Vitest — run with `bun run test`)

- [x] 4.1 Add `scripts/e2e_tests.test.ts` covering `computeVerdict`: PASS case (`exitCode 0`, `failed 0`, `timedOut 0`).
- [x] 4.2 Regression: `computeVerdict(0, { passed: 1265, failed: 1, timedOut: 0, skipped: 67 })` returns `{ failed: true }` — the exact observed false-green.
- [x] 4.3 `computeVerdict(0, null)` returns `{ failed: true }` (fail-closed) and a `reason` mentioning the cross-check could not run.
- [x] 4.4 Non-zero exit (`computeVerdict(1, { …all zero failures… })`) returns `{ failed: true }`; and a timed-out-only summary (`timedOut > 0`, `failed 0`) returns `{ failed: true }`.

## 5. Verification

- [x] 5.1 `bun run test` passes (never `bun test`).
- [x] 5.2 `bun run format:check`, `bun run lint`, and `bun run spell:check` pass.
- [x] 5.3 Confirm no `package.json` `files` change is needed (`e2e-summary.json` is generated at runtime, not shipped).
