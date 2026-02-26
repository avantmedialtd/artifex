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
   1. Detect project key by running `af jira projects --json`
      - If single project: use it
      - If multiple projects: ask the user to choose
   2. Fetch the topmost backlog issue using:
      ```bash
      af jira search "project = <PROJECT> AND status = Backlog ORDER BY priority DESC, created ASC" --limit 1 --json
      ```
   3. Display the issue summary and ask the user for confirmation before proceeding
   4. If no backlog issues found: inform the user the backlog is empty and stop
1. Fetch the issue details using `af jira get <issue-key>`.
2. Assign the issue to yourself using `af jira assign <issue-key> --to $(af jira get <issue-key> --json | jq -r '.reporter.emailAddress')` — but first check who the current user is by looking at the Jira config or asking.
3. Transition the issue to "In Progress" using `af jira transition <issue-key> --to "In Progress"`. If this fails, run `af jira transitions <issue-key>` to find the correct status name.
4. Create an OpenSpec change using the OPSX workflow:
   - Derive a `change-id` from the issue key and summary (kebab-case, verb-led)
   - Invoke the `openspec-new-change` skill (Skill tool) with the `change-id`
     - This scaffolds the change directory, shows artifact status, and provides the first artifact template
   - Then invoke the `openspec-continue-change` skill (Skill tool) to create the proposal artifact, enriching with Jira context:
     - Jira issue link: `**Jira**: [ISSUE-KEY](jira-url)`
     - Why section derived from Jira issue description
     - What Changes derived from issue details
   - Show the updated status
5. **STOP and hand off to OPSX workflow**

   Suggest: "Proposal created. Run `/opsx:continue` to create the next artifact, or `/opsx:ff` to generate all remaining artifacts."

**Reference**

- See `openspec/AGENTS.md` for OpenSpec conventions
- Run `af jira --help` for Jira CLI options
- See `/opsx:new` and `/opsx:ff` for the full artifact workflow
