# Add Jira Issue Links and Remote Links

## Why

The Jira CLI has no support for linking — neither issue-to-issue links (blocks, duplicates, relates to) nor remote links (Confluence pages, external documents). Users need to switch to the Jira web UI to view or manage linked work items and attached documents, breaking the CLI workflow.

## What Changes

- Display issue links in `af jira get` output (new "Linked Issues" section)
- Add `af jira link` subcommand to create typed links between Jira issues
- Add `af jira unlink` subcommand to remove a link between two issues
- Display remote links in `af jira get` output (new "Remote Links" section, requires separate API call)
- Add `af jira remote-link` subcommand to list, add, and remove remote links (URLs to Confluence pages, external docs, etc.)

## Capabilities

### New Capabilities

- `jira-issue-links`: Issue-to-issue linking — display, create, and remove typed directional links (blocks, duplicates, relates to, etc.) between Jira issues
- `jira-remote-links`: Remote link management — list, add, and remove URL-based links from Jira issues to external resources (Confluence pages, documents, websites)

### Modified Capabilities

- `jira-command`: New subcommands (`link`, `unlink`, `remote-link`) added to routing, help, and option parsing

## Impact

- **Types**: New interfaces for issue link and remote link data models in `jira/lib/types.ts`
- **Client**: New API functions in `jira/lib/client.ts` — issue link CRUD uses `/rest/api/3/issueLink`, remote link CRUD uses `/rest/api/3/issue/{key}/remotelink`
- **Formatters**: New display sections in `jira/lib/formatters.ts` — issue links render from existing issue fields, remote links require an additional API call
- **Commands**: New subcommand handlers and CLI options in `commands/jira.ts`
- **Help**: Updated help text in `commands/jira.ts` and `commands/help.ts`
