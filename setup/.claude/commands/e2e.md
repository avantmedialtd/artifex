---
name: Update E2E tests
description: Run E2E tests and fix any failures
category: Testing
tags: [e2e, playwright]
---

**Guardrails**

- Run only: `CI=1 FAIL_FAST=1 ./scripts/e2e_tests.ts`
- For specific tests: `CI=1 FAIL_FAST=1 ./scripts/e2e_tests.ts -- --grep "pattern"`

**Steps**

1. Run `CI=1 FAIL_FAST=1 ./scripts/e2e_tests.ts`
2. If failures, read `./test-results/*/error-context.md` for DOM state
3. Fix issues (for visual failures, run `./scripts/update-visual-baselines.ts` if intentional)
4. Use `--grep "pattern"` for faster iteration while debugging specific tests
5. Repeat from step 1 until all tests pass
6. **Final check**: Run full suite without `--grep` to confirm all tests pass before completing

**Reference**

- Use the `e2e-testing` skill for patterns and debugging tips
