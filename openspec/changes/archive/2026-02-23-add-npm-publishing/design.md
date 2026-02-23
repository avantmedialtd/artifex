## Context

Artifex is a Bun-native CLI tool. All entry points use `#!/usr/bin/env bun` shebangs and import TypeScript directly. Publishing the source as-is to NPM is the simplest path — users install Bun, then `npm install -g @avantmedia/af`, and the `af` binary works.

## Goals / Non-Goals

**Goals:**

- Users can install with `npm install -g @avantmedia/af`
- Published package contains only the files needed to run (no tests, openspec, dist, dev config)
- `bun link` continues to work for local development

**Non-Goals:**

- Node.js compatibility (Bun is required)
- Pre-compiled binary distribution (keep it simple)
- Auto-publishing via CI (manual for now)

## Decisions

### Publish source directly, require Bun

Publish the TypeScript source files as-is. Bun runs them natively without a build step. This avoids the complexity of transpilation, platform-specific packages, or binary distribution.

**Alternative considered**: Pre-compiled binaries via `optionalDependencies` (esbuild pattern). Rejected — adds 5 extra packages, platform detection shims, and 60-116 MB binaries. Unnecessary complexity when Bun is a reasonable prerequisite.

### Use `files` field for package contents

The `files` field in `package.json` explicitly lists what gets published: source directories (`commands/`, `components/`, `utils/`, `generated/`, `setup/`, `resources/`), entry points (`main.ts`, `router.ts`, `af`), and metadata (`LICENSE`, `README.md`). This keeps tests, openspec, dist, vscode-extension, and dev config out of the published package.

### Scoped package `@avantmedia/af`

Using a scoped name avoids conflicts with the short `af` name on the public registry. Requires `--access public` on first publish since scoped packages default to private.

### Remove `zap` alias

The `zap` binary was a backwards-compatibility alias. Remove the root `zap` file and `bin.zap` entry from `package.json`. Only `af` is published.

## Risks / Trade-offs

**Bun as prerequisite limits audience** → Acceptable trade-off for simplicity. Bun is easy to install and growing in adoption. Pre-compiled binaries can be added later if needed.

**`files` field must be maintained** → New top-level directories or entry points need to be added to `files`. Mitigated by keeping the flat project structure stable.

**NPM org `@avantmedia` must exist** → Manual prerequisite before first publish.
