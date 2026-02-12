---
name: Complete Work
description: Archive an OpenSpec change and transition the Jira issue to Done.
category: Workflow
tags: [jira, openspec, workflow]
---

**Usage**

```
/complete-work <issue-key>
```

Example: `/complete-work MUSH-123`

**Steps**

1. Fetch the issue details using `af jira get <issue-key>` to verify it exists and get the summary.
2. Find the associated OpenSpec change by searching `openspec/changes/*/proposal.md` files for the issue key using grep or by running `openspec list` and checking which change references this issue.
3. Archive the OpenSpec change using the OPSX workflow:
   1. Check artifact completion: `openspec status --change "<change-id>" --json`
      - If incomplete artifacts, warn but continue
   2. Check task completion: read `openspec/changes/<change-id>/tasks.md`, count `- [ ]` vs `- [x]`
      - If incomplete tasks, warn but continue
   3. Check for delta specs at `openspec/changes/<change-id>/specs/`
      - If delta specs exist, perform agent-driven sync to main specs (same as `/opsx:sync`)
   4. Archive: `mkdir -p openspec/changes/archive && mv openspec/changes/<change-id> openspec/changes/archive/YYYY-MM-DD-<change-id>`
4. Run the following command: `./scripts/create-commit.sh "<issue-summary>" "<issue-key>"` where `<issue-summary>` is derived from the Jira issue. This adds the issue key as a commit trailer.
6. Transition the issue to "Done" using `af jira transition <issue-key> --to "Done"`. If this fails, run `af jira transitions <issue-key>` to find the correct completion status name.

**Reference**

- See `openspec/AGENTS.md` for OpenSpec conventions (Stage 3: Archiving Changes)
- Run `af jira --help` for Jira CLI options
