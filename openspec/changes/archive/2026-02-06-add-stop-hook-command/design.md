## Context

Claude Code's Stop hook runs after every task. Currently, if configured to run `af e2e`, it runs even when only spec files or documentation changed. E2E tests are slow, so we want to skip them when no source code was modified.

The solution is an `af stop-hook` command that wraps `af e2e` with file change detection logic.

## Goals / Non-Goals

**Goals:**

- Skip e2e tests when only ignored paths (openspec/, docs, etc.) changed
- Allow customization of ignored paths via `af.json`
- Simple Claude hook config: just `af stop-hook`

**Non-Goals:**

- Generating Claude hook configuration (user writes that themselves)
- Support for other hook types beyond Stop

## Decisions

### File Change Detection

**Decision:** Use git to detect staged, unstaged, and untracked files:

```bash
git diff --name-only --cached 2>/dev/null      # Staged changes
git diff --name-only 2>/dev/null               # Unstaged changes
git ls-files --others --exclude-standard       # Untracked files
```

**Rationale:** Focuses on uncommitted work - all changes in the working directory that are relevant to the current session, including new files.

### Configuration File Format

**Decision:** Use `af.json` in project root with optional `stopHook` section.

```json
{
    "stopHook": {
        "ignoredPaths": ["openspec/", "docs/"],
        "command": "af e2e"
    }
}
```

**Rationale:**

- JSON is consistent with other config files
- Optional file - command works with sensible defaults if absent
- Single config file can grow to support other af commands later

### Default Ignored Paths

**Decision:** Default to `["openspec/"]`

**Rationale:** `openspec/` changes are specs/proposals, not source code requiring e2e tests.

### Exit Codes

**Decision:**

- Exit 0: No relevant changes, e2e skipped (or e2e passed)
- Exit 2: E2E tests failed

**Rationale:** Matches Claude hook conventions where exit 2 signals failure.

## Claude Hook Configuration

Users configure their Claude settings with:

```json
{
    "hooks": {
        "Stop": [
            {
                "matcher": "",
                "hooks": [
                    {
                        "type": "command",
                        "command": "af stop-hook",
                        "timeout": 3600
                    }
                ]
            }
        ]
    }
}
```

## Risks / Trade-offs

- **Risk:** Git state may be unusual (detached HEAD, no commits)
  - **Mitigation:** Suppress stderr, treat missing diffs as "no changes"

## Open Questions

None.
