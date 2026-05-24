## 1. Parser changes

- [x] 1.1 Add a `FLAG_ALIASES: Map<string, string>` next to the existing flag sets in `commands/bitbucket.ts`, with entries for `--source`, `--src`, `--destination`, `--dest`.
- [x] 1.2 In `parseArgs`, normalize the raw token at the top of the loop (`const arg = FLAG_ALIASES.get(rawArg) ?? rawArg`) so the boolean / number / repeatable / generic branches all operate on the canonical name.

## 2. Help text

- [x] 2.1 Add a one-line note under the `pr create` block in `showHelp` listing the accepted aliases for `--from` and `--to`. Leave the usage signature unchanged.

## 3. Tests

- [x] 3.1 Create `commands/bitbucket.test.ts` covering: each alias resolves to its canonical key, last-write-wins between canonical and alias, and last-write-wins between two aliases.
- [x] 3.2 Run `bun run test` and confirm the new file passes.

## 4. Verification

- [x] 4.1 Run `bun run format:check`, `bun run lint`, and `bun run spell:check`.
- [x] 4.2 Manually smoke-test `af bb pr create --help` to confirm the alias note renders as expected (no live PR creation needed).
