# Publish to NPM

## Why

Artifex is currently only installable via `bun link` from source. To reach a wider audience, it needs to be published to the public NPM registry so users can `npm install -g @avantmedia/af` and have it just work (with Bun installed).

## What Changes

- Publish `@avantmedia/af` to the public NPM registry as a source package requiring Bun
- **BREAKING**: Change license from proprietary (UNLICENSED) to MIT
- **BREAKING**: Change package name from `af` to `@avantmedia/af`
- **BREAKING**: Remove the `zap` binary alias
- Add `files` field to control what gets published (source only, no tests/openspec/dist)
- Add `keywords` for NPM discoverability
- Move `react-devtools-core` from production to dev dependencies
- Update README with NPM installation instructions and MIT license

## Capabilities

### New Capabilities

- `npm-package-config`: Package metadata, `files` field, keywords, and publish configuration for the public NPM registry

### Modified Capabilities

- `cli-executable`: Remove the `zap` alias (root `zap` file, `bin.zap` in package.json)
- `user-documentation`: README updates for NPM installation instructions, Bun prerequisite, and MIT license

## Impact

- **Modified files**: `package.json` (name, license, files, keywords, deps), `LICENSE`, `.gitignore`, `README.md`
- **Removed files**: `zap` (root binary alias)
- **NPM org**: Requires creating `@avantmedia` organization on npmjs.com before first publish
- **Runtime requirement**: Users must have Bun installed
