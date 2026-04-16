## Why

The `pm` skill bundled under `setup/.claude/skills/pm/` is no longer in scope for `af` and should stop being distributed via `af setup`. Removing it simplifies the setup bundle and narrows the surface area of what `af` installs into users' `~/.claude/` directory.

## What Changes

- Delete `setup/.claude/skills/pm/SKILL.md` and the entire `setup/.claude/skills/pm/templates/` directory (`api-endpoint.md`, `bug-fix.md`, `feature.md`, `ui-component.md`).
- Delete the now-empty `setup/.claude/skills/` parent directory.
- Regenerate `generated/setup-manifest.ts` so the bundle no longer embeds the removed files.
- Rewrite the **Nested directory copying** scenario in the `setup-command` spec to stop referencing `setup/.claude/skills/pm/SKILL.md` — either phrase the example hypothetically or drop the scenario since no real nested example remains in the bundle.

Users who previously ran `af setup` will retain `~/.claude/skills/pm/` on disk; no uninstall path is provided and that is intentional.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `setup-command`: the **Directory Structure Preservation** requirement's scenario currently names a concrete file (`setup/.claude/skills/pm/SKILL.md`) that will no longer exist, so the scenario needs to be reworded to reference a hypothetical nested file.

## Impact

- **Files deleted**: `setup/.claude/skills/pm/SKILL.md`, `setup/.claude/skills/pm/templates/api-endpoint.md`, `setup/.claude/skills/pm/templates/bug-fix.md`, `setup/.claude/skills/pm/templates/feature.md`, `setup/.claude/skills/pm/templates/ui-component.md`, and the `setup/.claude/skills/pm/` and `setup/.claude/skills/` directories.
- **Files regenerated**: `generated/setup-manifest.ts` via `bun run generate:manifest`.
- **Spec updated**: `openspec/specs/setup-command/spec.md` — the **Nested directory copying** scenario under **Directory Structure Preservation**.
- **No code changes** to command handlers, routing, or tests — the setup command discovers files dynamically at build time, so removing the source files is sufficient.
- **No migration** for existing user installations; stale `~/.claude/skills/pm/` directories are left untouched.
