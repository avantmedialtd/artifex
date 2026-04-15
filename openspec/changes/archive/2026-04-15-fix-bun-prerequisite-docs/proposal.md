# Proposal: Fix Bun prerequisite documentation

## Why

The README lists Bun as a user-facing prerequisite for installing Artifex from npm, but the `af` wrapper now ships a bundled Bun binary as a runtime dependency and is launched by a `#!/usr/bin/env node` shebang. End users installing via `npm install -g @avantmedia/af` only need Node.js ≥16 — Bun is resolved from the package's own `node_modules`. The `user-documentation` spec still mandates the old Bun-prereq wording, so the README cannot be corrected without also fixing the spec it derives from.

## What Changes

- Update `README.md` installation prerequisites to state Node.js ≥16 as the runtime requirement and describe Bun as a bundled runtime dependency installed automatically via npm.
- Clarify in `README.md` that Bun is still a prerequisite for the "Install from Source" / contributor workflow (running tests, formatting, compilation).
- Update the two stale scenarios in the `user-documentation` spec — "User installs from NPM" and "User checks system requirements" — so they no longer require the README to list Bun as a runtime prerequisite.
- No code or CLI behavior changes.

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `user-documentation`: installation-instructions requirement scenarios updated to reflect that Node.js is the runtime prerequisite and Bun ships as a bundled dependency.

## Impact

- `README.md` — Prerequisites and Platform Support sections.
- `openspec/specs/user-documentation/spec.md` — two scenarios under the "Installation instructions" requirement.
- No source code, no CLI behavior, no tests affected. Contributor workflow (Install from Source) remains unchanged and still uses Bun.
