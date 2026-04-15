---
name: Auto Work
description: Autonomously pick up a Jira issue and complete it end-to-end — plan, implement, test, verify, and deliver.
category: Workflow
tags: [jira, openspec, workflow, autonomous]
---

**Usage**

```
/work-auto [issue-key]
```

Examples:
- `/work-auto` — Takes the topmost issue from the board (asks for confirmation)
- `/work-auto PROJ-123` — Uses the specified issue

This command runs the FULL development cycle autonomously: pick up issue, plan, implement, test, verify, archive, commit, push, and confirm CI passes. It does NOT pause for confirmation at intermediate steps — only at the very start when selecting which issue to work on.

**Steps**

## Phase 1: Pick Up Issue

0. **If no issue-key is provided**, fetch the topmost issue from the board:
   1. Detect project key by running `af jira projects --json`
      - If single project: use it
      - If multiple projects: ask the user to choose
   2. Fetch the topmost backlog issue using:
      ```bash
      af jira search "project = <PROJECT> AND status = 'Selected for Development' ORDER BY Rank ASC" --limit 1 --json
      ```
   3. Display the issue summary and proceed immediately
   4. If no backlog issues found: inform the user the Selected for Development column is empty and **STOP**

1. Fetch the issue details using `af jira get <issue-key>`.

2. Assign the issue to yourself using `af jira assign <issue-key> --to $(af jira get <issue-key> --json | jq -r '.reporter.emailAddress')` — but first check who the current user is by looking at the Jira config or asking.

3. Transition the issue to "In Progress" using `af jira transition <issue-key> --to "In Progress"`. If this fails, run `af jira transitions <issue-key>` to find the correct status name.

4. Derive a `change-id` from the issue key and summary (kebab-case, verb-led). Store `<issue-key>`, `<issue-summary>`, and `<change-id>` for use in all remaining phases.

## Phase 2: Fast-Forward Artifacts

5. Invoke `/opsx:ff` (Skill tool) with the `<change-id>`.

   Enrich the proposal artifact with Jira context:
   - Jira issue link: `**Jira**: [ISSUE-KEY](jira-url)`
   - Why section derived from Jira issue description
   - What Changes derived from issue details

   This creates the change directory and generates ALL artifacts (proposal, specs, design, tasks) in one pass.

   **On failure**: If artifact creation fails critically (e.g., cannot create directory, CLI errors), report the error and **STOP**.

## Phase 3: Implement

6. Invoke `/opsx:apply` (Skill tool) with the `<change-id>`.

   This implements all tasks from the generated tasks.md. Let the skill run through all tasks without interruption.

   **Auto-mode behavior**: When the apply skill would normally pause for clarification, make reasonable decisions and continue. Prefer the simplest correct approach. If implementation reveals a true design issue that cannot be resolved with reasonable defaults, **STOP** and explain the issue.

## Phase 4: Test

7. Run E2E tests:
   ```bash
   af e2e
   ```

8. **If tests fail**, enter a fix-and-retry loop:
   - Read the reporter output for error messages, DOM snapshots, and file paths
   - For deeper debugging, read `./test-results/*/error-context.md` for full page state
   - Fix the code or test
   - If the failure is a visual regression from an intentional change, update baselines:
     ```bash
     af e2e npm run e2e -- --update-snapshots
     ```
   - Use `--grep "pattern"` to iterate faster on the specific failing test
   - Once the targeted test passes, run the full suite without `--grep` to confirm nothing else broke

   **Escape valve**: If E2E tests still fail after **3 full-suite attempts**, **STOP** and report which tests are failing, what fixes were attempted, and the current state.

## Phase 5: Verify

9. Invoke `/opsx:verify` (Skill tool) with the `<change-id>`.

10. Handle verification results autonomously:
    - **CRITICAL issues**: Attempt to fix them (complete tasks, implement missing requirements). After fixing, re-run verification once. If critical issues persist, **STOP** and report.
    - **WARNING issues**: Note them but continue.
    - **SUGGESTION issues**: Ignore in auto mode.

## Phase 6: Complete

11. **Archive the OpenSpec change:**
    Invoke `/opsx:archive` (Skill tool) with the `<change-id>`.

    In auto mode, when the archive skill encounters prompts:
    - Incomplete artifacts/tasks warnings: proceed
    - Delta spec sync prompt: choose "Sync now" (the recommended option)

12. **Commit with trailers:**
    ```bash
    git add -A
    git commit -m "<issue-summary>" \
      --trailer "Issue=<issue-key>" \
      --trailer "OpenSpec-Id=<change-id>"
    ```

13. **Transition Jira to Done:**
    ```bash
    af jira transition <issue-key> --to "Done"
    ```
    If this fails, run `af jira transitions <issue-key>` to find the correct completion status name.

14. **Push to remote:**
    ```bash
    git push
    ```

## Phase 7: CI Verification

15. Read the Jenkins job path from the project's CLAUDE.md (e.g., `Jenkins job: folder/job-name`). If not configured, skip this phase and warn the user.

16. Wait ~30 seconds for Jenkins to pick up the push, then poll build status:
    ```bash
    af jenkins build <job-path> latest --json
    ```
    Repeat every 30 seconds until the build is no longer in progress (check the `building` field or `result` field in JSON output).

17. **If build succeeds**: continue to final summary.

18. **If build fails**:
    - Run `af jenkins stages <job-path> latest` to identify the failing stage
    - Run `af jenkins stage-log <job-path> <failing-stage> latest` to read the error output
    - Fix the code based on the failure
    - Commit the fix using the same `git add -A && git commit -m "<issue-summary>" --trailer ...` pattern from Phase 6 step 12, push, and poll again

    **Escape valve**: If the build still fails after **3 CI attempts**, **STOP** and report the failing stage, error output, and what fixes were attempted.

## Final Summary

Display a completion summary:

```
## Work Complete

**Issue:** [ISSUE-KEY] <issue-summary>
**Change:** <change-id>
**Status:** Done

### Phases Completed
1. Issue picked up and transitioned to In Progress
2. All OpenSpec artifacts generated
3. All tasks implemented
4. E2E tests passing
5. Verification passed
6. Change archived, committed, pushed
7. CI build passed

All done.
```

## Auto Mode Behavior

This command runs without user interaction after the initial issue selection:

- **NO intermediate confirmations** — proceed through phases automatically
- **Make reasonable decisions** — when ambiguity arises, choose the simplest correct approach
- **Fix forward** — if tests or CI fails, fix the code and retry (up to escape valve limits)
- **Visual regression baselines** — update them automatically when the change intentionally affects the UI

## Escape Valves

The command **STOPS and reports** (rather than loop or proceed with broken state) when:

1. **Phase 1**: No issues in backlog, or Jira transitions fail
2. **Phase 2**: OpenSpec CLI errors or artifact creation fails
3. **Phase 3**: Unresolvable design issues during implementation
4. **Phase 4**: E2E tests fail after 3 full-suite retry attempts
5. **Phase 5**: Critical verification issues persist after one fix-and-reverify cycle
6. **Phase 6**: Commit or push fails (e.g., merge conflicts)
7. **Phase 7**: Jenkins build fails after 3 CI attempts

When stopped, always report: which phase failed, what was attempted, and the current state so the user can resume manually.

## Project Defaults

If the project instructions specify a default Jira project key (e.g., `Jira project: PROJ`), use it as the default for `--project`, `list`, `types`, and JQL queries. Explicit user input always overrides the default.

**Reference**

- See `openspec/AGENTS.md` for OpenSpec conventions
- Run `af jira --help` for Jira CLI options
- See `/opsx:ff`, `/opsx:apply`, `/opsx:verify`, `/opsx:archive` for individual phase details
- See `/e2e` for E2E test debugging patterns
- Run `af jenkins --help` for Jenkins CLI options
