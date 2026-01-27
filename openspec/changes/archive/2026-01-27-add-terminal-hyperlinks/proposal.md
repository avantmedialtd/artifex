# Add Terminal Hyperlinks

## Why

Jira issue keys and other identifiers are displayed as plain text, requiring users to manually copy and navigate to view them in their browser. Modern terminals support OSC 8 hyperlinks, which display clickable text without showing the full URL.

## What Changes

- Add a `link()` utility function to `utils/output.ts` that creates OSC 8 hyperlinks
- Update Jira formatters to make issue keys clickable (linking to `/browse/{issueKey}`)
- Update Jira formatters to make project keys clickable (linking to `/projects/{projectKey}`)
- Update Jira success messages to include clickable issue keys

## Impact

- Affected specs: `cli-output-formatting`
- Affected code:
  - `utils/output.ts` - New `link()` function
  - `jira/lib/formatters.ts` - Updated formatters to use hyperlinks
  - `commands/jira.ts` - Success messages with hyperlinks
