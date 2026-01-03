# Design: Add Setup Command

## Context

The Artifex CLI is distributed as a standalone binary compiled with Bun. Users need to install Claude Code configuration files (commands, skills, settings) to use advanced workflows. The `setup/` directory contains these files, but they need to be bundled into the binary for standalone distribution.

**Constraints:**
- Must work from compiled binary without external files
- Must dynamically discover files in `setup/` without code changes when files are added
- Must preserve directory structure when copying (e.g., `setup/.claude/foo` -> `~/.claude/foo`)
- Must handle conflicts gracefully with user prompts

## Goals / Non-Goals

**Goals:**
- Bundle all files from `setup/` into the compiled binary
- Provide simple CLI to copy files to home directory (`~/.claude/`)
- Handle file conflicts with interactive prompts
- Work identically in development and compiled modes

**Non-Goals:**
- Selective file installation (all files are copied as a set)
- Version tracking of installed files
- Automatic updates of previously installed files

## Decisions

### Decision 1: Build-time manifest generation

Generate a TypeScript module at build time that imports all files with `{ type: "file" }` attribute.

**Why:** Bun's file embedding requires explicit imports. A build script discovers files dynamically and generates the import statements, eliminating manual maintenance when files are added/removed.

**Alternatives considered:**
- Manual imports: Requires code changes for each file addition (rejected)
- Runtime file discovery: Not possible in compiled binaries (rejected)
- Glob pattern in build command: Less control over manifest structure (rejected)

### Decision 2: Dual-mode file access

The manifest stores paths that work in both development and compiled modes. In dev mode, files are read from disk. In compiled mode, files are read from the embedded bundle.

**Implementation:**
```typescript
export function isCompiled(): boolean {
    return SETUP_FILES[0]?.embeddedPath.startsWith('$bunfs');
}
```

### Decision 3: Interactive conflict resolution

When a target file exists, prompt the user with options: overwrite, skip, overwrite-all, skip-all. This gives users control while allowing batch operations.

**Why:** Users may have customized files they want to preserve, but also may want to update all files in one action.

### Decision 4: Precompile hook for manifest generation

Add `precompile` npm script that runs the manifest generator before compilation. This ensures the manifest is always current.

**Why:** Forgetting to regenerate the manifest would cause missing files in the binary. Automation prevents this error.

## Architecture

```
Build Time:
  setup/                     scripts/generate-setup-manifest.ts
    .claude/        ------>  Scans files and generates:
      settings.json          generated/setup-manifest.ts
      commands/                (imports with { type: "file" })
      skills/

Compile Time:
  bun build --compile        Embeds all imported files into
    main.ts                  the binary via Bun's bundler
    + generated/setup-manifest.ts

Runtime:
  af setup                   Reads manifest, copies files
    |                        from embedded paths to ~/.claude/
    v
  ~/.claude/
    settings.json
    commands/
    skills/
```

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Manifest out of sync with setup/ | Precompile hook automates regeneration |
| Large binary size | Setup files are ~40KB text, negligible vs 58MB binary |
| Path separator issues on Windows | Use `path.join()` and `path.sep` consistently |
| Permission errors writing to target | Wrap in try-catch with clear error messages |

## Open Questions

None - design is complete.
