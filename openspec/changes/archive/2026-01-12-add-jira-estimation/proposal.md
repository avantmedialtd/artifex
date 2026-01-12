# Proposal: Add Jira Estimation Support

## Why

Developers need to view and update time tracking fields (original estimate, remaining estimate, time spent) directly from the CLI to manage sprint planning and track work progress without context-switching to the Jira web interface.

## What Changes

- Add `timetracking` fields to `JiraIssueFields` type (originalEstimate, remainingEstimate, timeSpent with both human-readable and seconds variants)
- Display estimation fields in `af jira get` output when available
- Add `--estimate` and `--remaining` options to `af jira update` for setting time tracking values
- Add `--estimate` and `--remaining` options to `af jira create` for setting initial estimates
- Include estimation columns in `af jira list` and `af jira search` output

## Impact

- Affected specs: jira-command
- Affected code:
  - `jira/lib/types.ts` - Add time tracking types
  - `jira/lib/formatters.ts` - Display estimation in issue output
  - `jira/lib/client.ts` - Handle time tracking in create/update
  - `commands/jira.ts` - Add CLI options for estimation
