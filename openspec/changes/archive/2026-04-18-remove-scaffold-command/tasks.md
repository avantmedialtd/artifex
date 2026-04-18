## 1. Remove command code

- [x] 1.1 Delete `commands/scaffold.ts`
- [x] 1.2 Delete `commands/scaffold.test.ts`

## 2. Unwire from router and help

- [x] 2.1 Remove the `handleScaffold` import and route from `router.ts`
- [x] 2.2 Remove the `scaffold` entry from the help registry in `commands/help.ts`
- [x] 2.3 Remove the `scaffold <subcommand>` list item from the command summary in `commands/help.ts`

## 3. Verify

- [x] 3.1 Run `bun run test` and confirm all tests pass
- [x] 3.2 Run `bun run lint` and `bun run format:check`
- [x] 3.3 Run `./af help` and confirm `scaffold` no longer appears
- [x] 3.4 Run `./af scaffold test-compose` and confirm it surfaces the router's unknown-command error
