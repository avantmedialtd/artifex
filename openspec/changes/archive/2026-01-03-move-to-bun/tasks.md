# Tasks: Complete the Move to Bun

## 1. Implementation

- [x] 1.1 Create `bun-upgrade.ts` with `getBunOutdatedPackages()`, `bunUpgradePackage()`, and `bunUpgradeAllPackages()`
- [x] 1.2 Create `bun-upgrade.test.ts` unit tests for table parsing and upgrade logic
- [x] 1.3 Create `commands/bun.ts` with `handleBunUpgrade()` command handler
- [x] 1.4 Update `router.ts` to add routing for `bun` command
- [x] 1.5 Update `commands/help.ts` to include bun command help

## 2. CI Pipeline

- [x] 2.1 Update `Jenkinsfile` to use `bun install` and `bun run` commands

## 3. Cleanup

- [x] 3.1 Delete `package-lock.json`
- [x] 3.2 Update `.prettierignore` to remove `package-lock.json` entry

## 4. Documentation

- [x] 4.1 Update `README.md` with Bun commands and add bun upgrade section
- [x] 4.2 Update `CLAUDE.md` with Bun command references
- [x] 4.3 Update `openspec/project.md` with Bun command references

## 5. Testing

- [x] 5.1 Update `integration.test.ts` with bun command tests
- [x] 5.2 Run all tests and verify functionality
