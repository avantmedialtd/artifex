---
name: Complete Work
description: Archive an OpenSpec change and transition the Jira issue to Done.
category: Workflow
tags: [jira, openspec, workflow]
---

**Usage**

```
/complete-work
```

**Steps**

1. Find the active OpenSpec change in `openspec/changes/`. If multiple exist, ask the user which change to complete.
2. Read the proposal (`openspec/changes/<id>/proposal.md`) to extract the issue key (look for a Jira key pattern like `PROJ-123` in the metadata or body) and the title.
3. **If an issue key was found:** Fetch the issue details using `af jira get <issue-key>` to verify it exists and get the summary. **If no issue key was found:** Skip all Jira operations (steps 3, 6) and omit the `Issue=` trailer in step 5.
4. **Archive the OpenSpec change (if not already archived):**
   - Check if `openspec/changes/<id>/` directory exists
   - If it exists, invoke `/opsx:archive` (Skill tool) with the `<change-id>`
   - If the directory does not exist (already archived), skip this step
5. Commit with trailers:
   ```bash
   af commit save "<summary>" [Issue=<issue-key>] OpenSpec-Id=<change-id>
   ```
   Where `<summary>` is derived from the Jira issue (if available) or from the OpenSpec proposal title. Only include the `Issue=` trailer when an issue key is present.
6. **If an issue key was found:** Transition the issue to "Done" using `af jira transition <issue-key> --to "Done"`. If this fails, run `af jira transitions <issue-key>` to find the correct completion status name. **If no issue key:** Skip this step.
7. Push to remote: `git push`

## CI Verification

8. Read the Jenkins job path from the project's CLAUDE.md (e.g., `Jenkins job: folder/job-name`). If not configured, skip this phase and warn the user.

9. Wait ~30 seconds for Jenkins to pick up the push, then poll build status:
   ```bash
   af jenkins build <job-path> latest --json
   ```
   Repeat every 30 seconds until the build is no longer in progress (check the `building` field or `result` field in JSON output).

10. **If build succeeds**: Done.

11. **If build fails**:
    - Run `af jenkins stages <job-path> latest` to identify the failing stage
    - Run `af jenkins stage-log <job-path> <failing-stage> latest` to read the error output
    - Fix the code based on the failure
    - Commit using `af commit save`, push, and poll again

    **Escape valve**: If the build still fails after **3 CI attempts**, **STOP** and report the failing stage, error output, and what fixes were attempted.

**Reference**

- Run `openspec --help` for OpenSpec CLI options
- Run `af jira --help` for Jira CLI options
- Run `af jenkins --help` for Jenkins CLI options
