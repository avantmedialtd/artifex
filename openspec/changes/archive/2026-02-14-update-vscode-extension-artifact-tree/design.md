## Context

The VSCode extension currently models changes as flat task lists: Change → Section → Task. It was built when OpenSpec's `propose` command created all artifacts at once. The new artifact-driven workflow creates artifacts incrementally, so a change can exist with just a proposal.md and nothing else. The extension needs a new tree hierarchy that shows artifact progression.

Current source files:
- `types.ts` — `ChangeData`, `Section`, `Task` types
- `taskParser.ts` — Scans for changes, parses tasks.md
- `taskProvider.ts` — `OpenSpecTaskProvider` tree data provider with `OpenSpecTaskItem`
- `titleExtractor.ts` — Extracts title from proposal.md first line
- `extension.ts` — Activation, watchers, commands

## Goals / Non-Goals

**Goals:**
- Show all four artifacts (proposal, specs, design, tasks) as tree children of each change
- Infer artifact presence from file existence — no CLI or metadata dependencies
- Preserve the existing task drill-down (sections → checkboxes) under the Tasks node
- Show Specs as a container with individual spec capabilities as children
- Update badge to count changes that are unfinished (including changes with no tasks.md)

**Non-Goals:**
- Showing artifact dependency graph (blocked/ready states) — just present vs absent
- Reading .openspec.yaml or invoking the openspec CLI
- Supporting multiple schemas with different artifact sets
- Adding new commands for artifact creation

## Decisions

### Tree hierarchy: Change → Artifact → (children)

The tree gains an intermediate "artifact" level:

```
Change (root)
├── Proposal          → leaf, opens proposal.md
├── Specs             → container, children are spec capabilities
│   ├── auth          → leaf, opens specs/auth/spec.md
│   └── notifications → leaf, opens specs/notifications/spec.md
├── Design            → leaf, opens design.md
└── Tasks (3/5)       → container, children are sections → tasks
    ├── Section 1
    │   ├── ☑ Task 1
    │   └── ☐ Task 2
    └── Section 2
        └── ☐ Task 3
```

**Rationale**: This maps directly to the file system structure. Each artifact node corresponds to a known file or directory. No external metadata needed.

### New tree item type: `artifact`

Add `'artifact'` to the existing `TreeItemType` union (`'change' | 'section' | 'task'`). Artifact items carry:
- `artifactId`: one of `'proposal' | 'specs' | 'design' | 'tasks'`
- `present`: boolean (file exists)
- Reference to parent ChangeData for path resolution

**Icons**:
- Present artifact: `check` (ThemeIcon)
- Absent artifact: `circle-outline` (ThemeIcon)

This reuses the same icons already used for completed/incomplete tasks, keeping the visual language consistent.

### Artifact detection in parser

Expand `getChangeData()` to scan for all artifact files:

```
proposal.md  → exists?  boolean
specs/       → list directories containing spec.md → string[]
design.md    → exists?  boolean
tasks.md     → exists?  parse sections/tasks (existing logic)
```

Add an `artifacts` field to `ChangeData`:

```typescript
interface ArtifactStatus {
    proposal: boolean;
    specs: string[];   // capability names with spec.md files
    design: boolean;
    tasks: boolean;    // true if tasks.md exists (task details stay in sections/totalTasks/completedTasks)
}
```

### "Finished" definition

A change is finished when `tasks.md` exists AND `completedTasks === totalTasks` AND `totalTasks > 0`. This is nearly the same as before, except now a change with no `tasks.md` is explicitly unfinished (previously it was invisible).

### File watchers

Currently watches: `tasks.md`, `proposal.md`, directory changes.

Expand to also watch:
- `openspec/changes/**/design.md`
- `openspec/changes/**/specs/**/*.md`

All watchers share the existing debounced refresh (100ms).

### Change label format

Current: `Title (change-id) - X/Y tasks completed`

New: `Title (change-id)` with artifact/task progress shown in the artifact nodes themselves. The Tasks node shows `Tasks (3/5)` when tasks.md exists. The change-level label stays clean.

If no title is available (no proposal.md), fall back to just `change-id`.

## Risks / Trade-offs

- **More tree items per change** — Each change now has 4+ children instead of just sections. Mitigated by keeping artifacts collapsed-by-default when not created (they're just single lines).
- **Specs directory scanning** — Reading subdirectories of specs/ adds filesystem calls. Mitigated by the existing debounced refresh pattern and the fact that spec directories are small.
- **Design always shown even when optional** — A change might never need design.md, so it stays `○` permanently. Acceptable because it provides consistent visual structure and users learn the artifact set.
