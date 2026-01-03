# Tasks

## 1. Global Environment Loading

- [x] 1.1 Create `utils/env.ts` with `loadEnv()` function
- [x] 1.2 Load `.env` from `process.cwd()` (current working directory)
- [x] 1.3 Parse key=value pairs, handle quotes and comments
- [x] 1.4 Never fail if `.env` doesn't exist - silently skip
- [x] 1.5 Update `main.ts` to call `loadEnv()` at startup

## 2. Jira Command Integration

- [x] 2.1 Create `commands/jira.ts` with `handleJira(args: string[]): Promise<number>`
- [x] 2.2 Implement argument parsing for subcommands and options
- [x] 2.3 Delegate to jira client functions for each subcommand
- [x] 2.4 Use `utils/output.ts` for consistent error formatting

## 3. Jira Config Refactoring

- [x] 3.1 Remove custom `loadEnv()` from `jira/lib/config.ts`
- [x] 3.2 Implement lazy validation (only error when jira commands are used)
- [x] 3.3 Update `getConfig()` to throw descriptive errors for missing env vars

## 4. Router and Help Integration

- [x] 4.1 Add jira command routing in `router.ts`
- [x] 4.2 Add jira help content in `commands/help.ts`
- [x] 4.3 Include all subcommands in general help listing

## 5. Validation

- [x] 5.1 Run `npm run format` to format all files
- [x] 5.2 Run `npm run lint` to check for issues
- [x] 5.3 Run `npm run spell:check` to verify spelling
- [x] 5.4 Test `af jira --help` displays correct help
- [x] 5.5 Test `af jira projects` works with valid `.env`
- [x] 5.6 Test other `af` commands work without `.env` file
