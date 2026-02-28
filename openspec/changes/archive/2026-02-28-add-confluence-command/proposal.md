# Proposal: Add Confluence Command

## Why

AI agents need to programmatically manage Confluence documentation — reading pages for context, creating pages to capture decisions, and updating content as projects evolve. The existing `af jira` command proves the pattern works well for agent-driven Atlassian workflows; Confluence is the natural complement for knowledge management.

## What Changes

- Add `af confluence` command with full CRUD operations for pages, comments, labels, attachments, and spaces
- Extract shared Atlassian infrastructure (ADF converters, auth config, HTTP request helper) from the Jira client into `atlassian/lib/`
- Rename environment variables from `JIRA_*` to `ATLASSIAN_*` with backward-compatible fallback to legacy `JIRA_*` names
- Confluence client uses v2 API (`/wiki/api/v2/`) for most operations, falling back to v1 (`/wiki/rest/api/`) for search, labels, and attachment uploads

## Capabilities

### New Capabilities

- `confluence-command`: Full Confluence CLI with page CRUD, search (CQL), comments, labels, attachments, spaces, and page hierarchy. Supports `--json` output and `--body-file` for reading page content from markdown files.
- `atlassian-shared-config`: Shared Atlassian authentication and configuration module supporting `ATLASSIAN_*` environment variables with `JIRA_*` fallback.

### Modified Capabilities

- `jira-command`: Jira client now delegates ADF conversion and config to shared `atlassian/lib/` modules. No behavioral changes — backward-compatible re-exports maintained.
- `global-env-loading`: Environment variable names updated to prefer `ATLASSIAN_*` with `JIRA_*` fallback for backward compatibility.
- `jira-skill-documentation`: Documentation updated to reference `ATLASSIAN_*` as preferred variable names.

## Impact

- New directories: `atlassian/lib/`, `confluence/lib/`
- Modified: `jira/lib/client.ts`, `jira/lib/config.ts`, `jira/lib/formatters.ts`, `jira/lib/types.ts`
- Modified: `router.ts`, `commands/help.ts`, `package.json`, `.cspell.json`
- Requires same Atlassian Cloud credentials as Jira (shared authentication)
