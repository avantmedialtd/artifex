## 1. Remove the setup command subsystem

- [x] 1.1 Delete `commands/setup.tsx`
- [x] 1.2 Delete `utils/setup-files.ts`
- [x] 1.3 Delete `components/file-conflict.tsx` (used only by `af setup`)
- [x] 1.4 Delete the entire `setup/` directory (workflow command markdown files)
- [x] 1.5 Remove the `setup` route from `router.ts` and its import
- [x] 1.6 Remove the `setup` entry and any setup-specific examples from `commands/help.ts`

## 2. Remove the bun compile pipeline

- [x] 2.1 Remove `precompile`, `compile`, `compile:all`, `compile:darwin-arm64`, `compile:darwin-x64`, `compile:linux-x64`, `compile:linux-arm64`, `compile:windows-x64`, `compile:current`, and `generate:manifest` scripts from `package.json`
- [x] 2.2 Delete `scripts/generate-setup-manifest.ts`
- [x] 2.3 Delete `generated/setup-manifest.ts` (and the empty `generated/` directory if no other files remain)

## 3. Simplify resource loading

- [x] 3.1 Rewrite `utils/resources.ts` to read from `resources/` on disk directly (no `isCompiled` branch, no manifest import). Keep the public API (`extractResource`, `listResources`) so `scripts/e2e_tests.ts` continues to work.
- [x] 3.2 Remove any `isCompiled` re-export usage from callers, or delete it entirely if unused.
- [x] 3.3 Update `scripts/e2e_tests.ts` if it imports anything from `generated/setup-manifest.ts` that has been removed.

## 4. Update package manifest and docs

- [x] 4.1 Update `package.json` `files` whitelist: drop `"setup/"` and `"generated/"`.
- [x] 4.2 Remove the "Setup Command" section from `CLAUDE.md`.
- [x] 4.3 Remove any references to "Standalone Binary Compatibility" / compiled-mode behavior from `CLAUDE.md`, including the reporter-copying discussion if it mentions compiled mode.
- [x] 4.4 Update `README.md` if it references `af setup` or `bun compile`.

## 5. Verify

- [x] 5.1 `bun run format:check` passes.
- [x] 5.2 `bun run lint` passes.
- [x] 5.3 `bun run spell:check` passes.
- [x] 5.4 `bun run test` passes (unit tests).
- [x] 5.5 `af --help` no longer lists the `setup` command.
- [ ] 5.6 `af e2e` still runs end-to-end and copies the reporter into the Docker container.
- [x] 5.7 `openspec validate remove-setup-command-and-bun-compile --strict` passes.
