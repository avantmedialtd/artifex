## 1. Extract shared Atlassian infrastructure

- [x] 1.1 Create `atlassian/lib/adf-types.ts` with shared ADF type definitions
- [x] 1.2 Create `atlassian/lib/adf.ts` with `textToAdf()`, `adfToText()`, `parseInlineMarkdown()` extracted from Jira client
- [x] 1.3 Create `atlassian/lib/config.ts` with `ATLASSIAN_*` env vars and `JIRA_*` fallback, trailing slash normalization
- [x] 1.4 Create `atlassian/lib/request.ts` with shared HTTP request helper and auth headers
- [x] 1.5 Update `jira/lib/types.ts` to re-export ADF types from shared module
- [x] 1.6 Update `jira/lib/client.ts` to import ADF functions from shared module and re-export for backward compat
- [x] 1.7 Update `jira/lib/config.ts` to delegate to shared config
- [x] 1.8 Update `jira/lib/formatters.ts` to check `ATLASSIAN_BASE_URL` first
- [x] 1.9 Write tests for shared config (`atlassian/lib/config.test.ts`)
- [x] 1.10 Write tests for shared ADF (`atlassian/lib/adf.test.ts`)

## 2. Confluence API client

- [x] 2.1 Create `confluence/lib/types.ts` with page, space, comment, label, attachment interfaces
- [x] 2.2 Create `confluence/lib/client.ts` with `v2Url()` and `v1Url()` helpers
- [x] 2.3 Implement space operations: `listSpaces`, `getSpace`, `getSpaceByKey` (key-to-ID resolution)
- [x] 2.4 Implement page CRUD: `getPage`, `listPages`, `createPage`, `updatePage` (auto-version), `deletePage`
- [x] 2.5 Implement hierarchy: `getChildPages`, `getAncestors`
- [x] 2.6 Implement comments: `getComments`, `addComment`
- [x] 2.7 Implement labels: `getLabels` (v2), `addLabels` (v1), `removeLabel` (v1)
- [x] 2.8 Implement attachments: `getAttachments` (v2), `addAttachment` (v1 multipart)
- [x] 2.9 Implement search: `search` via v1 CQL endpoint

## 3. Confluence formatters

- [x] 3.1 Create `confluence/lib/formatters.ts` with terminal hyperlinks and ADF body parsing
- [x] 3.2 Implement formatters for pages, spaces, comments, labels, attachments, search results, page tree
- [x] 3.3 Implement dual-mode `output()` helper (JSON vs formatted markdown)

## 4. Confluence command handler

- [x] 4.1 Create `commands/confluence.ts` with arg parser and help text
- [x] 4.2 Implement all subcommands: get, list, search, create, update, delete, tree, comments, comment, labels, label, attachments, attach, spaces, space
- [x] 4.3 Support `--body` and `--body-file` for page content
- [x] 4.4 Support `--json` output flag across all subcommands

## 5. Integration and documentation

- [x] 5.1 Add confluence routing to `router.ts`
- [x] 5.2 Add confluence to help output in `commands/help.ts`
- [x] 5.3 Add new directories to `package.json` files array
- [x] 5.4 Add Confluence-related terms to `.cspell.json`
- [x] 5.5 Update `CLAUDE.md` with Confluence command documentation and updated project structure
- [x] 5.6 Update OpenSpec specs for modified capabilities (env loading, jira credential docs)
