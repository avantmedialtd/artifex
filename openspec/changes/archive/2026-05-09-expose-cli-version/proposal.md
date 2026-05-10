# Expose CLI version

## Why

Users have no way to determine which version of `af` they have installed, which makes it easy to assume a feature is missing when in fact it ships in a newer release that the user hasn't pulled. There is no `--version` flag, and the help banner does not display the version, so the only way to check today is to inspect the installed package metadata manually.

## What Changes

- Add a `--version` (and short `-v`) top-level flag that prints the installed version and exits.
- Display the installed version in the help banner shown by `af help` and the no-args invocation.
- Read the version at runtime from the package's own `package.json` so it stays in sync with the published artifact without any build step.

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `cli-help-system`: add a requirement for the `--version` / `-v` flag and a requirement that the help banner includes the installed version.

## Impact

- `router.ts`: early branch for `--version` / `-v` before command dispatch.
- `commands/help.ts`: prepend a version line to the banner.
- `utils/version.ts` (new): single source of truth that reads the version from the installed `package.json`. Reuses the `import.meta.dirname` pattern already established in `utils/resources.ts`.
- No new runtime dependencies. JSON imports rely on Bun's native support and the existing `resolveJsonModule: true` in `tsconfig.json`.
- `package.json` becomes a load-bearing runtime artifact; the existing `files` allowlist already publishes it implicitly via npm packaging, so no `files` change is required.
