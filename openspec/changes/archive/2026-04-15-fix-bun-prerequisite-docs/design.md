## Context

This is a documentation-only change correcting a mismatch between the README and the actual runtime architecture of the `af` CLI. The `af` wrapper is a Node.js script (`#!/usr/bin/env node`) that resolves a bundled Bun binary from its own `node_modules` (`bun` is declared as a runtime `dependency` in `package.json`, `engines.node` is `>=16`). End users installing `@avantmedia/af` from npm therefore need Node.js, not Bun. The `user-documentation` spec contains two scenarios that still mandate the opposite, so the README cannot be fixed in isolation.

## Goals / Non-Goals

**Goals:**

- README prerequisites accurately describe the runtime requirements for npm install (Node.js ≥16) and for contributor workflows (Bun).
- The `user-documentation` spec's "Installation instructions" requirement no longer mandates stale Bun-prereq wording.
- Spec and README stay in sync after the change.

**Non-Goals:**

- Broader README refresh (missing commands, idle indicator, etc.) — tracked separately.
- Renaming stale "Zap" references in `user-documentation/spec.md` — separate cleanup.
- Any change to `cli-executable` or `npm-package-config` specs — they already describe the current architecture correctly.
- Any source code, test, or CLI behavior change.

## Decisions

**Modify the existing "Installation instructions" requirement rather than splitting it.** The requirement still applies; only the scenario expectations need to change. A MODIFIED delta that re-states the full requirement block keeps the single logical unit coherent and matches the spec schema's guidance against partial MODIFIED content.

**Keep "Developer installs from source" scenario unchanged.** Contributors genuinely still need Bun (for `bun install`, `bun link`, tests, compile targets). Only the two runtime-facing scenarios need correction.

**Frame Bun as a "bundled runtime dependency" in the README.** This describes reality without exposing the internal launcher plumbing (Node shebang → resolve `bun/package.json` → spawn). Users don't need to know the mechanism, only that no separate install is required.

## Risks / Trade-offs

- **Risk:** Users may already have expectations set by old README wording and try to install Bun unnecessarily. → **Mitigation:** New wording explicitly states "no separate install required," and Bun remains as an optional path (nothing breaks if they install it).
- **Risk:** The `af` wrapper hardcodes `bin/bun.exe`, which would not resolve on POSIX systems — suggesting there may be a real cross-platform bug. → **Mitigation:** Out of scope for this docs fix; flag as a separate concern to triage.
