---
name: pm
description: Project management workflows for sprint planning, epic breakdowns, progress reporting, and backlog grooming. Uses the jira skill for all Jira operations.
---

# Project Manager Skill

High-level project management workflows that use the Jira CLI (`jira` skill) for operations.

## When to Use This Skill

Use the PM skill when the user wants to:
- Plan sprints or prioritize backlog items
- Break down epics or features into tasks
- Generate progress reports or standup summaries
- Identify risks (overdue, blocked, stale issues)
- Get project context for informed planning decisions
- Groom or refine the backlog

For individual issue operations (get, update, transition, comment), use the `jira` skill directly.

## Prerequisites

The `jira` skill must be configured. See `.claude/skills/jira/SKILL.md` for setup.

## Sub-Agent Behavior

When acting as a PM sub-agent, follow these guidelines:

### 1. Always Load Context First

Before planning or making recommendations, gather project state:

```bash
# Get open sprint issues
af jira search "project = PROJ AND sprint in openSprints() ORDER BY priority DESC"

# Check for blockers
af jira search "project = PROJ AND (status = Blocked OR labels = blocked)"

# Recent activity (last 48h)
af jira search "project = PROJ AND updated >= -2d ORDER BY updated DESC"
```

### 2. Use Templates for Consistency

When breaking down work, use templates from `.claude/skills/pm/templates/`:
- `api-endpoint.md` - REST/GraphQL endpoint implementation
- `ui-component.md` - React component development
- `bug-fix.md` - Bug investigation and fix
- `feature.md` - General feature implementation

### 3. Validate Before Executing

For bulk operations (creating multiple issues, updating priorities):
1. Show the user what will be created/modified
2. Wait for confirmation before executing
3. Execute one operation at a time, reporting progress

### 4. Track Dependencies

When creating related tasks, use Jira linking:
- Parent/subtask relationships via `--parent` flag
- Note blocking relationships in descriptions

### 5. Report on Completion

After multi-step workflows, provide a summary:
- What was created/modified
- Any issues encountered
- Next recommended actions

## Workflows

### Load Project Context

Gather comprehensive project state before planning:

```bash
# 1. Active sprint overview
af jira search "project = PROJ AND sprint in openSprints() ORDER BY status ASC, priority DESC" --limit 50

# 2. Blocked issues requiring attention
af jira search "project = PROJ AND (status = Blocked OR labels = blocked) ORDER BY priority DESC"

# 3. Upcoming deadlines (next 7 days)
af jira search "project = PROJ AND duedate >= now() AND duedate <= 7d AND status != Done ORDER BY duedate ASC"

# 4. Unassigned high-priority items
af jira search "project = PROJ AND assignee IS EMPTY AND priority in (Highest, High) ORDER BY created ASC"
```

Present findings organized by:
- Sprint progress (done/in-progress/todo counts)
- Blockers requiring attention
- Upcoming deadlines
- Unassigned work

### Sprint Planning

Help plan upcoming sprints:

```bash
# 1. Check current sprint velocity (completed in last sprint)
af jira search "project = PROJ AND sprint in closedSprints() AND status = Done ORDER BY resolutiondate DESC" --limit 30

# 2. Get backlog candidates (not in any sprint, prioritized)
af jira search "project = PROJ AND sprint IS EMPTY AND status = Backlog ORDER BY priority DESC, created ASC" --limit 30

# 3. Check team capacity (assigned work)
af jira search "project = PROJ AND assignee IS NOT EMPTY AND status != Done"
```

Planning steps:
1. Calculate velocity from recent sprints
2. Present top backlog items with estimates
3. Suggest sprint composition based on capacity
4. Create issues or move items to sprint after confirmation

### Epic Breakdown

Break down an epic into implementable tasks:

```bash
# 1. Get epic details
af jira get PROJ-123

# 2. Check for existing subtasks
af jira search "parent = PROJ-123"
```

Breakdown process:
1. Read the epic description and acceptance criteria
2. Select appropriate template from `.claude/skills/pm/templates/`
3. Generate subtask list with estimates
4. Present for review
5. Create subtasks after confirmation:

```bash
af jira create --project PROJ --type Sub-task --summary "Task title" --parent PROJ-123
```

### Progress Report

Generate status reports:

**Daily Report:**
```bash
# Completed yesterday
af jira search "project = PROJ AND status changed to Done AFTER -1d"

# In progress today
af jira search "project = PROJ AND status = 'In Progress' ORDER BY assignee"

# Blocked
af jira search "project = PROJ AND (status = Blocked OR labels = blocked)"
```

**Weekly Report:**
```bash
# Completed this week
af jira search "project = PROJ AND status changed to Done AFTER -7d ORDER BY resolutiondate DESC"

# Created this week
af jira search "project = PROJ AND created >= -7d ORDER BY created DESC"

# Scope changes (added to sprint mid-week)
af jira search "project = PROJ AND sprint in openSprints() AND created >= -7d"
```

**Sprint Report:**
```bash
# Sprint completion
af jira search "project = PROJ AND sprint in openSprints()" --limit 100

# Calculate: done / total issues
# Identify: carried over items, added mid-sprint items
```

### Standup Summary

Generate daily standup content from Jira activity:

```bash
# Done (status changed to Done in last 24h)
af jira search "project = PROJ AND status changed to Done AFTER -1d"

# In Progress (currently being worked on)
af jira search "project = PROJ AND status = 'In Progress' AND assignee = currentUser()"

# Blockers
af jira search "project = PROJ AND (status = Blocked OR labels = blocked) AND assignee = currentUser()"
```

Format as:
- **Done**: [list of completed items]
- **Today**: [list of in-progress items]
- **Blockers**: [list of blocked items with reasons]

### Risk Identification

Find issues that need attention:

```bash
# Overdue (past due date, not done)
af jira search "project = PROJ AND duedate < now() AND status != Done ORDER BY duedate ASC"

# Stale (no updates in 7+ days, not done)
af jira search "project = PROJ AND status != Done AND updated < -7d ORDER BY updated ASC"

# Blocked
af jira search "project = PROJ AND (status = Blocked OR labels = blocked)"

# Scope creep (added to sprint after start)
af jira search "project = PROJ AND sprint in openSprints() AND created >= startOfSprint()"

# Under-resourced (unassigned high priority)
af jira search "project = PROJ AND assignee IS EMPTY AND priority in (Highest, High) AND status != Done"
```

Categorize and present:
- **Critical**: Overdue items, high-priority blockers
- **Warning**: Stale items, scope creep indicators
- **Attention**: Unassigned high-priority work

### Backlog Grooming

Help prioritize and refine backlog:

```bash
# Get backlog items
af jira search "project = PROJ AND sprint IS EMPTY AND status = Backlog ORDER BY created ASC" --limit 50

# Check for duplicates or related items
af jira search "project = PROJ AND summary ~ 'keyword'"
```

Grooming activities:
1. Review items for clarity and completeness
2. Suggest priority adjustments based on:
   - Age (older items may need re-evaluation)
   - Dependencies (blocking other work)
   - Business value indicators in description
3. Identify candidates for archiving (very old, low priority)
4. Flag items needing more detail

To update priority after confirmation:
```bash
af jira update PROJ-123 --priority High
```

### Dependency Analysis

Map dependencies for an issue:

```bash
# Get issue with links
af jira get PROJ-123

# Find related issues by summary/labels
af jira search "project = PROJ AND (summary ~ 'related-keyword' OR labels = related-label)"

# Find potential blockers (same component, earlier in pipeline)
af jira search "project = PROJ AND component = 'Component' AND status != Done"
```

Present as:
- **Blocks**: Issues this blocks
- **Blocked by**: Issues blocking this
- **Related**: Similar or dependent work

## JQL Quick Reference

Common queries for project management:

| Purpose | JQL |
|---------|-----|
| My open issues | `assignee = currentUser() AND status != Done` |
| Open sprint | `project = PROJ AND sprint in openSprints()` |
| Blocked | `project = PROJ AND (status = Blocked OR labels = blocked)` |
| Overdue | `project = PROJ AND duedate < now() AND status != Done` |
| Stale (7d) | `project = PROJ AND status != Done AND updated < -7d` |
| Unassigned | `project = PROJ AND assignee IS EMPTY` |
| High priority | `project = PROJ AND priority in (Highest, High)` |
| Created this week | `project = PROJ AND created >= -7d` |
| Done this week | `project = PROJ AND status changed to Done AFTER -7d` |
| Backlog | `project = PROJ AND sprint IS EMPTY AND status = Backlog` |

## Tips

- **Replace PROJ**: Substitute with actual project key in all queries
- **Adjust time ranges**: `-7d`, `-2d`, etc. can be customized
- **Use --json for parsing**: When you need to analyze results programmatically
- **Combine with jira**: This skill provides workflows; jira provides operations
