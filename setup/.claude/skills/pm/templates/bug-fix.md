# Bug Fix Template

Work breakdown for investigating and fixing a bug.

## Task Structure

When breaking down a bug fix, create these subtasks:

### 1. Reproduce
- **Summary**: Reproduce {bug}
- **Description**: Confirm reproduction steps, document environment, capture evidence
- **Estimate**: 30m-1h

### 2. Investigate
- **Summary**: Investigate root cause of {bug}
- **Description**: Debug, trace code paths, identify the source of the issue
- **Estimate**: 1-3h

### 3. Implement Fix
- **Summary**: Fix {bug}
- **Description**: Implement the solution, handle edge cases
- **Estimate**: 1-3h

### 4. Write Regression Test
- **Summary**: Add regression test for {bug}
- **Description**: Write test that would have caught this bug
- **Estimate**: 30m-1h

### 5. Verify Fix
- **Summary**: Verify {bug} is fixed
- **Description**: Confirm original reproduction steps no longer reproduce the issue
- **Estimate**: 30m

## Simplified Flow (Minor Bugs)

For simple bugs, combine into fewer tasks:

### 1. Investigate & Fix
- **Summary**: Investigate and fix {bug}
- **Description**: Reproduce, find root cause, implement fix
- **Estimate**: 1-2h

### 2. Add Test
- **Summary**: Add regression test for {bug}
- **Description**: Write test to prevent recurrence
- **Estimate**: 30m

## Example Jira Commands

```bash
# Create subtasks for PROJ-300 (the bug)
./scripts/jira/jira.ts create --project PROJ --type Sub-task --summary "Reproduce login timeout bug" --parent PROJ-300

./scripts/jira/jira.ts create --project PROJ --type Sub-task --summary "Investigate root cause of login timeout" --parent PROJ-300

./scripts/jira/jira.ts create --project PROJ --type Sub-task --summary "Fix login timeout bug" --parent PROJ-300

./scripts/jira/jira.ts create --project PROJ --type Sub-task --summary "Add regression test for login timeout" --parent PROJ-300
```

## Investigation Checklist

When investigating:
- [ ] Can reproduce consistently?
- [ ] What changed recently? (git log, deployments)
- [ ] Environment-specific? (browser, OS, data)
- [ ] Related to recent code changes?
- [ ] Are there similar past bugs?

## Fix Checklist

Before marking as done:
- [ ] Bug no longer reproducible
- [ ] Regression test added
- [ ] No new issues introduced
- [ ] Related areas tested
- [ ] Root cause documented in ticket
