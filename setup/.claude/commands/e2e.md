---
name: Update E2E tests
description: Run E2E tests and fix any failures
category: Testing
tags: [e2e, playwright]
---

**Guardrails**

- Run only: `CI=1 af e2e`
- For specific tests: `CI=1 af e2e npm run e2e -- --grep "pattern"`

**Steps**

1. Run `CI=1 af e2e`
2. If failures, read `./test-results/*/error-context.md` for DOM state
3. Fix issues (for visual failures, run `af e2e npm run e2e -- --update-snapshots` if intentional)
4. Use `--grep "pattern"` for faster iteration while debugging specific tests
5. Repeat from step 1 until all tests pass
6. **Final check**: Run full suite without `--grep` to confirm all tests pass before completing

**Reference**

- Use the `e2e-testing` skill for patterns and debugging tips
