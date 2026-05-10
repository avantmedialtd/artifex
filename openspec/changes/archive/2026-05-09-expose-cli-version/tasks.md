## 1. Version helper

- [x] 1.1 Add `utils/version.ts` exporting `getVersion(): string` that reads from `package.json` via Bun's JSON import (`import pkg from '../package.json' with { type: 'json' }`)
- [x] 1.2 Add a unit test in `utils/version.test.ts` asserting `getVersion()` returns the value declared in `package.json`

## 2. `--version` / `-v` flag

- [x] 2.1 Add an early branch in `router.ts` (before any subcommand dispatch) that handles `args[0] === '--version'` or `args[0] === '-v'` by printing `getVersion()` followed by a newline and returning `0`
- [x] 2.2 Add tests covering both flag forms and confirming no "unknown command" error is emitted

## 3. Help banner

- [x] 3.1 Update `commands/help.ts` to prepend `af v<version>` (using `getVersion()`) as the first non-empty line of the banner
- [x] 3.2 Verify the no-args invocation (which routes to help) shows the same banner

## 4. Quality gates

- [x] 4.1 Run `bun run format:check` and fix any violations
- [x] 4.2 Run `bun run lint:check` and fix any violations
- [x] 4.3 Run `bun run spell:check` and fix any violations
- [x] 4.4 Run `bun run test` and confirm all tests pass
