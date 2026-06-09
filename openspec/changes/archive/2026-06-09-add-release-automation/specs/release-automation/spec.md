## ADDED Requirements

### Requirement: Version bump tooling

The project SHALL provide a `bun run bump <patch|minor|major|x.y.z>` script that
rewrites the `version` field in `package.json` (the npm source of truth). It MUST
NOT create a git commit or tag. It MUST preserve the rest of the file unchanged so
formatting checks stay green, and MUST expose its version math as pure functions
that are unit-tested without executing the CLI.

#### Scenario: Bumping the patch version

- **WHEN** a developer runs `bun run bump patch` with `package.json` at `0.0.18`
- **THEN** `package.json` `version` becomes `0.0.19`
- **AND** no other line of `package.json` changes
- **AND** no git commit or tag is created

#### Scenario: Dry run writes nothing

- **WHEN** a developer runs `bun run bump patch --dry-run`
- **THEN** the target version `v0.0.18 -> v0.0.19` is printed
- **AND** `package.json` is left unmodified

#### Scenario: Refusing a downgrade

- **WHEN** a developer runs `bun run bump <x.y.z>` with a version not greater than the current one
- **THEN** the command exits non-zero with an error
- **AND** `--force` is required to override

#### Scenario: Version math is unit-tested in isolation

- **WHEN** the test suite imports the bump module
- **THEN** the pure version helpers are exercised directly
- **AND** importing the module does not parse argv or write any file

### Requirement: Guided release command

The project SHALL provide a `/release` command that orchestrates a release from
`master` in the primary checkout. It MUST run read-only preflight checks (on
`master`, clean tree, not ahead of origin, latest CI green), suggest a version bump
via a structured question, synthesize curated notes, and present an approval gate
before any mutation. Only after approval MUST it bump the version, write the notes,
commit both in one "Release <tag>" commit, create an annotated `v<version>` tag, and
push with `--follow-tags`.

#### Scenario: Nothing mutates before approval

- **WHEN** `/release` runs up to the approval gate
- **THEN** the only side effect is writing the `releases/<tag>.md` file on disk
- **AND** no commit, tag, or push has occurred

#### Scenario: Approved release is committed, tagged, and pushed

- **WHEN** the user approves the release
- **THEN** `package.json` and `releases/<tag>.md` are committed together as "Release <tag>"
- **AND** an annotated tag `v<version>` is created on that commit
- **AND** the commit and tag are pushed to `origin/master` together

#### Scenario: Refusing to run off master

- **WHEN** `/release` is invoked from a branch other than `master`
- **THEN** it stops with an error and makes no changes

### Requirement: Curated release notes from archived changes

Each release SHALL have a `releases/<tag>.md` notes file (one per tag, named with the
leading `v` to match `github.ref_name`). The notes MUST be synthesized from the
OpenSpec changes archived since the previous tag — using each change's `proposal.md`
title and rationale as the spine — grouped into Highlights / Improvements / Removed /
Fixes sections (empty sections omitted), and MUST end with an npm install footer and a
GitHub compare link.

#### Scenario: Notes are built from the release window

- **WHEN** notes are synthesized for a new tag
- **THEN** changes added under `openspec/changes/archive/` since the previous tag are gathered
- **AND** their proposals form the basis of the grouped notes

#### Scenario: Notes carry an install footer and changelog link

- **WHEN** a `releases/<tag>.md` file is produced
- **THEN** it contains an Install section referencing `npm install -g @avantmedia/af`
- **AND** a `compare/<previous-tag>...<tag>` changelog link

### Requirement: Tag-triggered npm publish workflow

A GitHub Actions workflow SHALL publish the package when a `v*` tag is pushed. It MUST
run the full CI gate set (lint, format, spell, test), publish with
`npm publish --provenance --access public`, and create a GitHub Release whose body is
`releases/<tag>.md`. Publishing MUST be the last irreversible step, performed only
after all pre-publish guards pass.

#### Scenario: Tag push publishes and releases

- **WHEN** a `v<version>` tag is pushed and all guards and gates pass
- **THEN** `@avantmedia/af@<version>` is published to the public npm registry with provenance
- **AND** a GitHub Release for the tag is created from `releases/<tag>.md`

#### Scenario: Non-tag pushes never publish

- **WHEN** commits are pushed to a branch without a `v*` tag
- **THEN** the publish workflow does not run and nothing is published

### Requirement: Pre-publish guards

Before publishing, the workflow MUST fail loudly if any of the following do not hold:
the tag equals the `package.json` version, the tagged commit is an ancestor of
`origin/master`, a non-empty `releases/<tag>.md` exists, and (on a first attempt) the
version is not already on npm.

#### Scenario: Tag and package version disagree

- **WHEN** the pushed tag does not match `package.json` `version`
- **THEN** the workflow fails before publishing

#### Scenario: Tag points at a commit not on master

- **WHEN** the tagged commit is not contained in `origin/master`
- **THEN** the workflow fails before publishing

#### Scenario: Missing release notes block the publish

- **WHEN** `releases/<tag>.md` is absent or empty
- **THEN** the workflow fails before publishing

### Requirement: Resumable publish

The workflow MUST be safe to re-run after a partial failure. If the version is already
published, a re-run MUST NOT attempt to publish again, MUST NOT fail solely because of
the duplicate, and MUST still be able to create or update the GitHub Release.

#### Scenario: Re-running after the release step failed

- **WHEN** a run published to npm but failed before creating the GitHub Release, and the run is retried
- **THEN** the publish step is skipped rather than erroring on the duplicate version
- **AND** the GitHub Release is created on the retry

#### Scenario: Duplicate version on a fresh run is rejected

- **WHEN** a brand-new run targets a version already on npm
- **THEN** the workflow fails with a clear "already published — bump the version" error

### Requirement: Release infrastructure excluded from the published package

The release tooling (bump script, `releases/`, the workflow, the command) SHALL NOT be
included in the published npm tarball, and a guard SHALL block accidental local
publishes outside CI.

#### Scenario: Tarball excludes release infrastructure

- **WHEN** `npm pack --dry-run` is run
- **THEN** the tarball file list is unchanged from before this change
- **AND** it contains no bump script, `releases/` directory, or workflow

#### Scenario: Local publish outside CI is blocked

- **WHEN** `npm publish` is run on a developer machine without `CI` set
- **THEN** the `prepublishOnly` guard throws and the publish is aborted
