---
name: Run E2E tests
description: Run E2E tests and fix any failures
category: Testing
tags: [e2e, playwright]
---

**Guardrails**

- Run only inside Docker via `af e2e` — never run Playwright directly
- For specific tests: `af e2e -- --grep "pattern"`
- For specific files: `af e2e -- tests/Feature.spec.ts`

**Steps**

1. Run `af e2e` (defaults to `--max-failures=1` for fast feedback)
2. On failure, read the reporter output — it includes error messages, DOM snapshots, and file paths
3. For deeper debugging, read `./test-results/*/error-context.md` for full page state
4. Fix the code or test
5. If the failure is a visual regression from an intentional change, update baselines:
   `af e2e -- --update-snapshots`
6. Use `--grep "pattern"` to iterate faster on the specific failing test
7. Once the targeted test passes, run the full suite without `--grep` to confirm nothing else broke

**Reference**

- Use the `e2e-testing` skill for test patterns, selectors, and debugging tips
- HTML report: `./playwright-report/index.html`
- Trace files: `./test-results/*/trace.zip`
