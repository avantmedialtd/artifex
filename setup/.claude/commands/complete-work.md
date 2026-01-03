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

1. Fetch the issue details using `./scripts/jira/jira.ts get <issue-key>` to verify it exists and get the summary.
2. Find the associated OpenSpec change by searching `openspec/changes/*/proposal.md` files for the issue key using grep or by running `openspec list` and checking which change references this issue.
3. Archive the OpenSpec change using `openspec archive <change-id> --yes`. This will:
   - Move `changes/<id>/` to `changes/archive/YYYY-MM-DD-<id>/`
   - Apply spec deltas to the main specs
4. Validate the archive succeeded with `openspec validate --strict`.
5. Run the following command: `./scripts/create-commit.sh "<issue-summary>" "<issue-key>"` where `<issue-summary>` is derived from the Jira issue. This adds the issue key as a commit trailer.
6. Transition the issue to "Done" using `./scripts/jira/jira.ts transition <issue-key> --to "Done"`. If this fails, run `./scripts/jira/jira.ts transitions <issue-key>` to find the correct completion status name.

**Reference**

- See `openspec/AGENTS.md` for OpenSpec conventions (Stage 3: Archiving Changes)
- Run `./scripts/jira/jira.ts --help` for Jira CLI options
