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
3. **Archive the OpenSpec change (if not already archived):**
   - Check if `openspec/changes/<id>/` directory exists
   - If it exists, invoke `/opsx:archive <id>`
   - If the directory does not exist (already archived), skip this step
4. Run the following command: `./scripts/create-commit.sh "<issue-summary>" "<issue-key>"` where `<issue-summary>` is derived from the Jira issue. This adds the issue key as a commit trailer.
5. Transition the issue to "Done" using `af jira transition <issue-key> --to "Done"`. If this fails, run `af jira transitions <issue-key>` to find the correct completion status name.
6. Push to remote: `git push`

**Reference**

- See `openspec/AGENTS.md` for OpenSpec conventions (Stage 3: Archiving Changes)
- Run `af jira --help` for Jira CLI options
