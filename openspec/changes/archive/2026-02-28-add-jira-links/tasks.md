## 1. Types

- [x] 1.1 Add `JiraIssueLinkType`, `JiraIssueLink` interfaces to `jira/lib/types.ts`
- [x] 1.2 Add `issuelinks?: JiraIssueLink[]` to `JiraIssueFields`
- [x] 1.3 Add `JiraRemoteLink` interface to `jira/lib/types.ts` (id, object.url, object.title)
- [x] 1.4 Add `--from`, `--url`, `--title`, `--remove` to `JiraOptions` in `commands/jira.ts`

## 2. Issue Links — Client

- [x] 2.1 Add `linkIssue(outwardKey, type, inwardKey)` to `jira/lib/client.ts` — POST `/rest/api/3/issueLink`
- [x] 2.2 Add `unlinkIssue(linkId)` to `jira/lib/client.ts` — DELETE `/rest/api/3/issueLink/{id}`

## 3. Remote Links — Client

- [x] 3.1 Add `getRemoteLinks(issueKey)` to `jira/lib/client.ts` — GET `/rest/api/3/issue/{key}/remotelink`
- [x] 3.2 Add `addRemoteLink(issueKey, url, title)` to `jira/lib/client.ts` — POST `/rest/api/3/issue/{key}/remotelink`
- [x] 3.3 Add `removeRemoteLink(issueKey, linkId)` to `jira/lib/client.ts` — DELETE `/rest/api/3/issue/{key}/remotelink/{id}`

## 4. Formatters

- [x] 4.1 Add "Linked Issues" section to `formatIssue()` in `jira/lib/formatters.ts` — after subtasks, before comments
- [x] 4.2 Add "Remote Links" section to `formatIssue()` — requires accepting remote links as a parameter
- [x] 4.3 Add `formatRemoteLinks(issueKey, links)` formatter for the standalone `remote-link` list command

## 5. Command Handlers

- [x] 5.1 Add `link` subcommand to `commands/jira.ts` — validate args, call `client.linkIssue()`
- [x] 5.2 Add `unlink` subcommand to `commands/jira.ts` — fetch issue, find matching link, call `client.unlinkIssue()`
- [x] 5.3 Add `remote-link` subcommand to `commands/jira.ts` — route between list, add (`--add`), and remove (`--remove`)
- [x] 5.4 Update `get` subcommand to fetch remote links in parallel and pass to formatter

## 6. Help and Documentation

- [x] 6.1 Update `showJiraHelp()` in `commands/jira.ts` with link, unlink, and remote-link commands and options
- [x] 6.2 Update `commands/help.ts` with link examples

## 7. Verification

- [x] 7.1 Run `bun run format:check`, `bun run lint`, `bun run spell:check`, and `bun test`
