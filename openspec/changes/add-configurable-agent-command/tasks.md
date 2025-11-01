# Tasks: Add configurable agent command via ZAP_AGENT

## Implementation Tasks

- [ ] **Update `utils/claude.ts` to read ZAP_AGENT environment variable**
  - Add helper function `getAgentCommand()` that returns `process.env.ZAP_AGENT || 'claude'`
  - Update `checkClaudeAvailable()` to use `getAgentCommand()` instead of hardcoded `'claude'`
  - Export `getAgentCommand()` for reuse in other modules
  - **Validation**: Run `ZAP_AGENT=test-agent node -e "import('./utils/claude.js').then(m => console.log(m.getAgentCommand()))"` and verify output is `test-agent`

- [ ] **Update `commands/spec.ts` to use configurable agent command**
  - Import `getAgentCommand()` from `utils/claude.ts`
  - Replace all 3 hardcoded `'claude'` strings in `spawn()` calls with `getAgentCommand()`
  - Update error messages to dynamically reference the configured agent name
  - **Validation**: Search codebase with `rg "spawn\s*\(\s*'claude'" --type ts` and confirm no matches remain

- [ ] **Add tests for configurable agent command**
  - Add test in `utils/claude.test.ts` for `getAgentCommand()` with `ZAP_AGENT` set
  - Add test in `utils/claude.test.ts` for `getAgentCommand()` with `ZAP_AGENT` unset (default)
  - Add test in `spec-propose.test.ts` verifying `ZAP_AGENT` is respected
  - **Validation**: Run `npm test` and verify all tests pass

- [ ] **Update documentation**
  - Add `ZAP_AGENT` environment variable to README.md usage section
  - Update CLAUDE.md to mention the configurable agent command capability
  - Include examples of using custom agent commands
  - **Validation**: Review documentation for clarity and completeness

- [ ] **Final verification**
  - Test with default behavior: `zap spec propose "test"` (should use `claude`)
  - Test with custom agent: `ZAP_AGENT=echo zap spec propose "test"` (should use `echo`)
  - Run full test suite: `npm test`
  - Run linter: `npm run lint`
  - **Validation**: All checks pass, behavior is correct with and without `ZAP_AGENT` set
