---
name: Start Work
description: Assign a Jira issue to yourself and convert it into an OpenSpec proposal.
category: Workflow
tags: [jira, openspec, workflow]
---

**Usage**

```
/start-work [issue-key]
```

Examples:
- `/start-work` — Takes the topmost issue from the backlog
- `/start-work MUSH-123` — Uses the specified issue

**Steps**

0. **If no issue-key is provided**, fetch the topmost issue from the backlog:
   1. Detect project key by running `./scripts/jira/jira.ts projects --json`
      - If single project: use it
      - If multiple projects: ask the user to choose
   2. Fetch the topmost backlog issue using:
      ```bash
      ./scripts/jira/jira.ts search "project = <PROJECT> AND status = Backlog ORDER BY priority DESC, created ASC" --limit 1 --json
      ```
   3. Display the issue summary and ask the user for confirmation before proceeding
   4. If no backlog issues found: inform the user the backlog is empty and stop
1. Fetch the issue details using `./scripts/jira/jira.ts get <issue-key>`.
2. Assign the issue to yourself using `./scripts/jira/jira.ts assign <issue-key> --to $(./scripts/jira/jira.ts get <issue-key> --json | jq -r '.reporter.emailAddress')` — but first check who the current user is by looking at the Jira config or asking.
3. Transition the issue to "In Progress" using `./scripts/jira/jira.ts transition <issue-key> --to "In Progress"`. If this fails, run `./scripts/jira/jira.ts transitions <issue-key>` to find the correct status name.
4. Create an OpenSpec proposal based on the issue:
   - Use the issue key and summary to derive a `change-id` (kebab-case, verb-led)
   - Review `openspec/project.md`, run `openspec list` and `openspec list --specs` to understand current context
   - Scaffold `proposal.md`, `tasks.md`, and spec deltas under `openspec/changes/<id>/`
   - Include a link to the Jira issue in `proposal.md`
   - Draft spec deltas with `## ADDED|MODIFIED|REMOVED Requirements` and at least one `#### Scenario:` per requirement
   - Validate with `openspec validate <id> --strict`

**Proposal Template**

```markdown
# Issue summary

## Why

[Derived from Jira issue description]

**Jira**: [ISSUE-KEY](jira-url)

## What Changes

- [Bullet list derived from issue]

## Impact

- Affected specs: [list capabilities]
- Affected code: [key files/systems]
```

**Reference**

- See `openspec/AGENTS.md` for OpenSpec conventions
- Run `./scripts/jira/jira.ts --help` for Jira CLI options
