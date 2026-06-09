# Automate npm Publishing with a Tag-Driven Release Flow

## Why

Releasing `@avantmedia/af` is entirely manual today: hand-edit `version` in
`package.json`, commit "Increment version", and run `npm publish` locally. There
are no git tags, no release notes, and no way to reproduce or audit a release.
The sibling project `specforge` already has a polished, tag-driven release flow —
adapting it gives `af` one-command releases, an authenticated CI publish with
provenance, and curated notes synthesized from the OpenSpec changes that actually
shipped.

## What Changes

- A `bun run bump <patch|minor|major|x.y.z>` script rewrites the `version` field
  in `package.json` (the npm source of truth) with pure, unit-tested version math.
- A `/release` command guides a release end-to-end from `master`: pick the bump,
  synthesize curated `releases/<tag>.md` notes from archived OpenSpec changes,
  approval gate, then commit + annotated tag + push.
- A `.github/workflows/release.yml` triggers on a `v*` tag push and, after a chain
  of cheap pre-publish guards (tag↔version match, tag on `master`, notes present,
  not already published) and the full CI gate set, runs
  `npm publish --provenance --access public` and creates the GitHub Release. npm
  publish is the last, irreversible side effect; the publish step is resumable so a
  release-step flake never bricks a re-run.
- A `releases/` directory (one `releases/<tag>.md` per release) holds the curated
  notes that become each GitHub Release body.
- `package.json` gains the `bump` script and a CI-only `prepublishOnly` guard that
  blocks accidental local publishes. README and CLAUDE.md document the new flow.

Out of scope: this change ships the *flow*; it publishes nothing. The first real
release is cut later by the user via `/release` once the npm `NPM_TOKEN` secret
exists. No prerelease (`-rc`/`-beta`) support; no semantic-release/changesets
(curated notes are the point).

## Capabilities

### New Capabilities

- `release-automation`: version-bump tooling, the tag-triggered npm-publish
  workflow (guards, provenance, resumable publish, GitHub Release), the `/release`
  orchestration command, and the curated `releases/<tag>.md` notes convention.

### Modified Capabilities

<!-- None. The static package configuration (scoped name, files whitelist, license,
deps) defined by `npm-package-config` is unchanged; this adds the publishing
*process* on top of it. -->

## Impact

- New: `scripts/bump-version.ts`, `scripts/bump-version.test.ts`,
  `.github/workflows/release.yml`, `.claude/commands/release.md`,
  `releases/README.md`.
- Modified: `package.json` (`bump` + `prepublishOnly` scripts; no `files` change —
  release infra is dev-only and stays out of the tarball), `README.md`,
  `CLAUDE.md`, `.cspell.json` (new doc terms).
- External, one-time, manual (cannot be automated): create an npm granular access
  token scoped to `@avantmedia/af` and store it as the GitHub Actions `NPM_TOKEN`
  secret. Requires `id-token: write` permission for provenance (the repo is public).
- Supersedes the manual "Increment version" + local `npm publish` workflow.
