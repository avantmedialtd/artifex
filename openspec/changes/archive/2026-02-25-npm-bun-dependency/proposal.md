# Bundle Bun Runtime as NPM Dependency

## Why

Artifex is distributed via NPM (`npm install -g @avantmedia/af`), but the `af` wrapper script uses `#!/usr/bin/env bun`, requiring users to have Bun pre-installed. This defeats the convenience of NPM distribution since users must install a separate runtime first.

## What Changes

- **BREAKING**: The `af` wrapper script changes from a Bun shebang script to a Node.js launcher that finds and spawns Bun from the package's own `node_modules`
- Add `bun` as a runtime dependency in `package.json` (the `bun` NPM package provides the Bun runtime via platform-specific optional dependencies)
- Lower the `engines.node` requirement from `>=22.6.0` to `>=16` since the wrapper only needs basic Node.js
- Users no longer need Bun pre-installed; it comes bundled with the package

## Capabilities

### New Capabilities

_None_ - this change modifies existing capabilities only.

### Modified Capabilities

- `cli-executable`: The `af` entry point changes from a Bun shebang script to a Node.js launcher that resolves and spawns the Bun binary from the `bun` dependency
- `npm-package-config`: The package gains `bun` as a runtime dependency and lowers the Node.js engine requirement

## Impact

- **Files**: `af` (rewrite), `package.json` (dependency + engines changes)
- **Dependencies**: Adds `bun` (~5.9 KB wrapper + platform-specific binary via optional deps)
- **Install size**: Increases by ~60-100 MB (Bun runtime binary, downloaded once per platform)
- **Startup**: Slightly slower (Node.js starts, finds Bun, Bun runs TypeScript) vs direct Bun execution
- **Breaking**: Users who depend on `af` being a Bun script (e.g., sourcing it) will need to adjust, though normal CLI usage is unaffected
