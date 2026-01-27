## 1. Core Link Utility

- [x] 1.1 Add `link(text: string, url: string): string` function to `utils/output.ts`
- [x] 1.2 Add unit tests for the link function

## 2. Jira Formatter Updates

- [x] 2.1 Add `getBaseUrl()` helper to formatters to access Jira base URL
- [x] 2.2 Update `formatIssue()` to make issue key clickable in header
- [x] 2.3 Update `formatIssue()` to make parent issue key clickable
- [x] 2.4 Update `formatIssue()` to make subtask keys clickable
- [x] 2.5 Update `formatIssueList()` to make issue keys clickable in table
- [x] 2.6 Update `formatTransitions()` to make issue key clickable in header
- [x] 2.7 Update `formatComments()` to make issue key clickable in header
- [x] 2.8 Update `formatAttachments()` to make issue key clickable in header
- [x] 2.9 Update `formatProjects()` to make project keys clickable

## 3. Jira Command Updates

- [x] 3.1 Update success messages in `commands/jira.ts` to use hyperlinked issue keys
- [x] 3.2 Ensure hyperlinks work with markdown output format

## 4. Testing

- [x] 4.1 Manual testing of hyperlinks in terminal emulator (iTerm2, Terminal.app)
- [x] 4.2 Verify graceful degradation in terminals without OSC 8 support
