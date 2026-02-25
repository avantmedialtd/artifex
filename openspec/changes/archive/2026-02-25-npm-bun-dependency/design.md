## Context

The `af` CLI wrapper is currently a 2-line Bun script (`#!/usr/bin/env bun` + `import './main.ts'`). Users installing via `npm install -g @avantmedia/af` must separately install Bun, which is a poor experience. The `bun` NPM package (5.9 KB) already solves cross-platform Bun distribution using `optionalDependencies` with `@oven/bun-*` platform packages - the same pattern used by esbuild, SWC, and Biome.

## Goals / Non-Goals

**Goals:**
- Users can `npm install -g @avantmedia/af` and run `af` without pre-installing Bun
- Zero changes to application code (commands, components, utils)
- Development workflow (`./af` with Bun directly) continues to work

**Non-Goals:**
- Removing Bun as the application runtime (Bun still executes main.ts)
- Platform-specific binary distribution of Artifex itself (the compiled binaries remain a separate concern)
- Supporting package managers that disable both `optionalDependencies` and `postinstall` scripts

## Decisions

### 1. Use the `bun` NPM package as a dependency

**Choice:** Add `"bun": ">=1.1.0"` to `dependencies`.

**Why over alternatives:**
- **vs. platform-specific packages** (esbuild pattern): Requires publishing 6 packages per release with a custom publish script. The `bun` package already solves this exact problem.
- **vs. postinstall download**: Fails behind corporate firewalls, flagged by security audits.
- **vs. bundling to JS** (`bun build --target=node`): Breaks `import ... with { type: 'file' }` manifest embedding, requires redesigning the setup command.

### 2. Node.js launcher with `spawn` for signal forwarding

**Choice:** Rewrite `af` as a CommonJS Node.js script that resolves the Bun binary via `require.resolve('bun/package.json')` and spawns it with `child_process.spawn`.

**Why `spawn` over `execFileSync`:** Artifex uses Ink for interactive terminal UI (text input, selection, confirmation). `spawn` with signal forwarding ensures SIGINT/SIGTERM propagate correctly to Ink components for clean unmounting.

**Why CommonJS over ESM:** Maximum compatibility across Node.js versions. The wrapper's only job is to find and run Bun - no modern JS features needed.

### 3. Resolve Bun via `require.resolve`, not PATH

**Choice:** Find the Bun binary using `require.resolve('bun/package.json')` to locate the package directory, then join `bin/bun.exe`.

**Why:** When installed as a dependency of a global package, npm does not symlink transitive binaries to the global bin directory. The Bun binary would not be on PATH. `require.resolve` works regardless of how or where the package is installed (npm, yarn, pnpm, global, local).

## Risks / Trade-offs

- **Startup latency** (~50-100ms overhead): Node.js starts, resolves bun, spawns process. Acceptable for a CLI tool. → Mitigation: None needed; the overhead is negligible compared to actual command execution.
- **Install size** (+60-100 MB): The Bun runtime binary is large. → Mitigation: This is a one-time download and comparable to tools like esbuild or Biome that also bundle native binaries.
- **Bun version coupling**: Users get whatever Bun version is specified in the dependency range. → Mitigation: Use `>=1.1.0` to allow the latest compatible version. Pin more tightly if Bun introduces breaking changes.
