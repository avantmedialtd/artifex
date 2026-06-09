## 1. Version bump tooling

- [x] 1.1 Create `scripts/bump-version.ts`: export pure `parseSemVer`, `compare`, `format`, `nextVersion`; CLI body (read `package.json`, regex-rewrite only the `version` line, print `v<old> -> v<new>`) guarded by `if (import.meta.main)`. Support `--dry-run` and `--force`; refuse downgrade/equal explicit versions and an already-existing `v<next>` tag. No commit, no tag.
- [x] 1.2 Create `scripts/bump-version.test.ts` (Vitest): patch/minor/major math, explicit `x.y.z`, downgrade refusal, non-semver parse rejection — importing the module must not run the CLI or touch the filesystem.
- [x] 1.3 Add `"bump": "bun run scripts/bump-version.ts"` to `package.json` scripts (named `bump`, not `version`, to avoid npm's lifecycle hook).

## 2. Tag-triggered publish workflow

- [x] 2.1 Create `.github/workflows/release.yml`: trigger `on: push: tags: ['v*']`; `concurrency: { group: release, cancel-in-progress: false }`; `permissions: { contents: write, id-token: write }`.
- [x] 2.2 Pre-publish guards (each fails before publish): checkout `fetch-depth: 0`; assert `package.json` version == `${GITHUB_REF_NAME#v}`; assert tagged commit is an ancestor of `origin/master`; assert `releases/<tag>.md` exists and is non-empty.
- [x] 2.3 Resumable publish: `npm view @avantmedia/af@<version>` (run before setup-node) → `published` output; fail only when `published==true && run_attempt=='1'`; gate gates+publish on `published=='false'`.
- [x] 2.4 Gates + publish: `setup-bun` + `bun install` + lint/format/spell/test; `setup-node@v4` (`node-version: 22`, `registry-url`); `npm publish --dry-run --access public`; then `npm publish --provenance --access public` with `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}` scoped to that step.
- [x] 2.5 GitHub Release step (no `if:`, runs on resume): `softprops/action-gh-release@v2` with `body_path: releases/${{ github.ref_name }}.md`, `make_latest: true`, `generate_release_notes: false`.

## 3. Release command and notes

- [x] 3.1 Create `releases/README.md` documenting the one-file-per-tag convention and the npm Install footer (adapted from specforge, no platform bundles).
- [x] 3.2 Create `.claude/commands/release.md`: master-only preflight; resolve current version from `package.json` and the window from the last `v*` tag (first-run fallback to the last "Increment version" commit); gather archived changes via `git log <lastTag>..HEAD --diff-filter=A --name-only -- openspec/changes/archive/`; AskUserQuestion bump (default patch); synthesize `releases/<tag>.md` (Highlights/Improvements/Removed/Fixes + Install footer + compare link); approval gate; on approve `bun run bump` → write notes → commit both → annotated tag → `push --follow-tags`; then `gh run watch` and report URLs / recovery options.

## 4. Package config and docs

- [x] 4.1 Add `"prepublishOnly": "node -e \"if(!process.env.CI) throw new Error('Publish via CI only')\""` to `package.json` (block accidental local publishes; do not double-run tests).
- [x] 4.2 Update `README.md` "Publishing to NPM" section: document the `/release` + tag-push flow as primary, the one-time `NPM_TOKEN` setup, and keep manual `npm publish` only as an emergency fallback.
- [x] 4.3 Add a "Release Flow" section to `CLAUDE.md` (bump script, `/release`, the workflow, `releases/`).
- [x] 4.4 Add new doc terms to `.cspell.json` as needed (e.g. `provenance`, `npmjs`) so `spell:check` passes.

## 5. Verification

- [x] 5.1 `bun run test` (new bump tests + existing suite), `bun run lint`, `bun run format:check`, `bun run spell:check` — all green.
- [x] 5.2 `bun run bump patch --dry-run` prints `v0.0.18 -> v0.0.19` and writes nothing; `git status` clean afterward.
- [x] 5.3 `npm pack --dry-run` shows the tarball file list unchanged (no release infra shipped); `af` retains its executable bit.
- [x] 5.4 Validate `release.yml` (parse/lint) and `openspec validate add-release-automation --strict`.
