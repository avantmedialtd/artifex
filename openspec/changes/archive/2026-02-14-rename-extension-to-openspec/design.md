## Context

The VSCode extension is currently identified as `openspec-tasks` with display name "OpenSpec Tasks". All command IDs use the `openspecTasks` prefix, configuration keys use `openspecTasks.*`, and the view ID is `openspecTasks`. The view container is already `openspec`.

This is a bulk rename across the extension's manifest, source code, and related specs. No architectural changes are needed.

## Goals / Non-Goals

**Goals:**
- Consistent "OpenSpec" branding across the extension
- Clean command/config namespace using `openspec` prefix
- Updated VSIX filename for distribution

**Non-Goals:**
- Changing extension functionality or behavior
- Adding migration tooling for user settings (manual migration is acceptable for a pre-1.0 extension)
- Changing the view container ID (already `openspec`)

## Decisions

### Command prefix: `openspec.*`

Use `openspec` as the command prefix instead of keeping `openspecTasks` or using something else like `os`.

**Rationale**: `openspec` matches the extension identifier and is the natural namespace. It's what users would search for in the command palette.

### View ID: `openspecChanges`

Rename the view ID from `openspecTasks` to `openspecChanges` rather than `openspec` (which is taken by the view container).

**Rationale**: The view displays changes, not just tasks. `openspecChanges` is more descriptive and avoids collision with the container ID.

### Configuration prefix: `openspec.*`

Rename settings from `openspecTasks.autoCollapseCompletedSections` to `openspec.autoCollapseCompletedSections`.

**Rationale**: Consistent with the new extension identity. Single config key makes this trivial.

### No settings migration

Users must manually update their `settings.json` if they customized the collapsed sections setting.

**Rationale**: The extension is pre-1.0 with a small user base. A single boolean setting doesn't warrant migration tooling.

## Risks / Trade-offs

- **Old extension left installed** → Users must manually uninstall `openspec-tasks` and install `openspec`. This is acceptable for a pre-1.0 extension with limited distribution.
- **Lost user settings** → The one configurable setting (`autoCollapseCompletedSections`) resets to default. Negligible impact.
