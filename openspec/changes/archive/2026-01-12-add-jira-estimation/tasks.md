# Tasks

## 1. Type Definitions

- [x] 1.1 Add `JiraTimeTracking` interface to `jira/lib/types.ts`
- [x] 1.2 Add `timetracking` field to `JiraIssueFields` interface
- [x] 1.3 Add `timetracking` to `JiraCreateIssueRequest.fields`
- [x] 1.4 Add `timetracking` to `JiraUpdateIssueRequest.fields`

## 2. Client Updates

- [x] 2.1 Update `createIssue` function to accept and pass `originalEstimate` parameter
- [x] 2.2 Update `updateIssue` function to accept and pass `originalEstimate` and `remainingEstimate` parameters

## 3. Formatter Updates

- [x] 3.1 Add estimation row to `formatIssue` output table (show Original/Remaining/Spent when available)
- [x] 3.2 Add Estimate column to `formatIssueList` table output

## 4. CLI Command Updates

- [x] 4.1 Add `--estimate` option to `JiraOptions` interface
- [x] 4.2 Add `--remaining` option to `JiraOptions` interface
- [x] 4.3 Update `parseArgs` to handle new options
- [x] 4.4 Pass estimate to `createIssue` call
- [x] 4.5 Pass estimate/remaining to `updateIssue` call
- [x] 4.6 Update help text with new options
