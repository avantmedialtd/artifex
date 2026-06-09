## Context

`af` is published as `@avantmedia/af` (currently `0.0.18`) and ships **raw
TypeScript** run by a bundled Bun — there is no build step. Releases are manual:
edit `version`, commit, `npm publish` locally. The repo is **public** on GitHub,
CI already runs lint/format/spell/test on every push via
`.github/workflows/ci.yml` (using `oven-sh/setup-bun@v2`).

The model we are adapting is `specforge`'s release flow: `bun run version` →
`v*` tag push → `release.yml` → curated `releases/<tag>.md` notes (authored by a
`/release` command from archived OpenSpec changes) → published GitHub Release. The
one structural difference: specforge is a *private Tauri app* where the git tag is
the version source of truth and `package.json` version is unused; `af` is a
*published npm package* where **`package.json` version is the source of truth** —
npm publishes exactly that value.

## Goals / Non-Goals

**Goals:**
- One-command releases (`/release`) that bump, write curated notes, tag, and push.
- A CI publish that is authenticated, attestable (provenance), and safe to re-run.
- Release notes synthesized from the OpenSpec changes that actually shipped.
- The publish path never fires by accident — only a deliberate `v*` tag triggers it.

**Non-Goals:**
- Building/compiling (there is none) or shipping release infra in the npm tarball.
- Prerelease channels (`-rc`/`-beta`); semantic-release/changesets; auto-changelog.
- Cutting an actual release as part of this change — it ships the flow only.

## Decisions

### `package.json` is the version source of truth; the tag is derived
Unlike specforge, the bump script rewrites `package.json`'s `version`. The workflow
re-derives the version from the tag (`${GITHUB_REF_NAME#v}`) and **asserts it equals
`package.json` version**, failing loudly on drift. Rationale: npm publishes the
`package.json` value, so it must be authoritative and committed; the tag is a
pointer to the commit that carries it. *Alternative rejected:* stamp version from
the tag at publish time (specforge's model) — wrong for npm, where the committed
value is what users install.

### `scripts/bump-version.ts` rewrites only the version line, and is named `bump`
The script does a targeted regex replace (`/("version":\s*)"[^"]*"/`) so the file
stays byte-identical elsewhere (no Prettier drift; `format:check` stays green). It
exports pure helpers (`parseSemVer`/`compare`/`format`/`nextVersion`) and guards
its CLI body behind `if (import.meta.main)` so the Vitest import has no side
effects — mirroring how `scripts/e2e_tests.ts` exports `computeVerdict`. The npm
script key is **`bump`, not `version`**, to avoid colliding with npm's `version`
lifecycle hook on a published package. The script does **not** commit or tag.

### `/release` owns commit + tag + push (one atomic release commit)
Because the bumped `package.json` and the new `releases/<tag>.md` must land together
in the commit the tag points at, the bump script stays side-effect-light and
`/release` orchestrates: `bun run bump <type>` → write notes → `git add` both →
`git commit -m "Release <tag>"` → `git tag -a <tag>` → `git push --follow-tags`.
Nothing mutates before an explicit approval gate. `/release` runs on `master` in the
primary checkout, never a worktree.

### Workflow: all cheap guards before the one irreversible side effect
Order (each fails cheaply before publish): checkout (`fetch-depth: 0`) → assert
tag==`package.json` version → assert tagged commit is an ancestor of `origin/master`
(reject stray-branch tags) → assert `releases/<tag>.md` exists and is non-empty →
check npm for the version → run CI gates → `npm publish --dry-run` →
**`npm publish --provenance --access public`** → **GitHub Release last**. npm publish
is irreversible (a version number is burned forever); the GitHub Release is a
mutable announcement that points at it, so it must come after.

### Resumable publish (a release-step flake must not brick a re-run)
The npm existence check sets a `published` output instead of hard-failing. A
duplicate-version error is raised only when `published == 'true' && run_attempt == '1'`
(a genuine mistake on a fresh run). Gates + publish are gated on `published == 'false'`,
so a re-run after "publish ok / release failed" *skips* publish (skips are not
failures) and still creates the Release (the Release step has no `if:`, runs under
default `success()`, and `softprops/action-gh-release` is idempotent for an existing
tag). This is the safest recovery story.

### Provenance + auth specifics
Provenance works here: public repo + scoped public package + `id-token: write` +
`repository.url` present. `node-version: 22` is pinned so npm ≥ 9.5 (provenance
floor) is guaranteed rather than relying on a runner default. Auth uses
`actions/setup-node` `registry-url` + `NODE_AUTH_TOKEN` scoped to the publish step;
the npm-existence read runs **before** setup-node writes the token `.npmrc` to avoid
an empty-token read error. `NPM_TOKEN` must be a **granular access token** (or classic
*Automation* token) scoped to `@avantmedia/af` — a classic *Publish* token is
2FA-gated and fails in CI.

### Curated notes from archived OpenSpec changes; npm Install footer
`/release` finds changes added in the window
(`git log <lastTag>..HEAD --diff-filter=A --name-only -- openspec/changes/archive/`),
uses each `proposal.md` title + Why as the spine, and groups into
✨ Highlights / 🔧 Improvements / 🗑 Removed / 🩹 Fixes. The footer is an **Install**
block (`npm install -g @avantmedia/af`) + a `compare/<lastTag>...<tag>` link — not
specforge's platform-bundle footer. First run (no `v*` tag) falls back to the window
since the last "Increment version" commit and notes it's the first tagged release.

### Release infra stays out of the published tarball
`scripts/bump-version.ts`, `releases/`, and the workflow are dev/release-only. The
existing `files` allowlist already excludes them (`scripts/` is allowlisted as the
single file `scripts/e2e_tests.ts`, and `!**/*.test.ts` drops the test). **No `files`
change**, verified with `npm pack --dry-run`. A CI-only `prepublishOnly`
(`node -e "if(!process.env.CI) throw …"`) blocks accidental local publishes without
double-running tests.

## Risks / Trade-offs

- **Tag pushed on a non-master commit publishes wrong code** → branch-ancestry guard
  (`git merge-base --is-ancestor` against `origin/master`) rejects it pre-publish.
- **Missing/empty notes discovered after publish** → an early non-empty
  `releases/<tag>.md` guard runs before publish.
- **Re-run after partial failure double-publishes** → `published`-output + `run_attempt`
  logic makes publish skip-on-resume; the Release step is idempotent.
- **`NPM_TOKEN` blast radius / 2FA** → granular token scoped to one package, with
  expiry; provenance auth is OIDC and orthogonal to the publish token.
- **`make_latest: true` on a future backport** would wrongly move the `latest`
  dist-tag — acceptable now (forward releases only); revisit if backporting.
- **Stale lockfile** → release job mirrors CI's `bun install`; if a lockfile is
  committed, `--frozen-lockfile` can be added to fail loudly on drift.

## Migration Plan

1. Land this change to `master` (commits only — **no tag**, so nothing publishes).
2. One-time, manual: create the npm granular token and
   `gh secret set NPM_TOKEN -R avantmedialtd/artifex`.
3. First release: run `/release` on `master`; it supersedes the manual "Increment
   version" + local `npm publish` workflow from then on.
- **Rollback:** if a release run fails, delete the tag
  (`git push origin --delete <tag>` + `git tag -d <tag>`), fix, and re-run `/release`;
  or fix forward with a patch release.

## Open Questions

- Bump-suggestion heuristic while pre-1.0 (`0.0.x`): default **patch**, offer minor
  for a milestone/new capability. `/release` asks via AskUserQuestion, so the human
  decides per release — no automation lock-in.
