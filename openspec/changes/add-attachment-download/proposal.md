# Download Jira and Confluence attachments

## Why

af can upload an attachment (`af jira attach`, `af confluence attach`) but cannot download one. A screenshot attached to a bug, or a log attached to a support ticket, can only be opened in the browser. That leaves agents, which read issues through af, with no way to see it.

`af jira get` also never says that an issue has attachments:

- `getIssue` already requests `fields=*all`, so every response carries `fields.attachment`, but `formatIssue` prints no part of it.
- An image embedded in a description is dropped by the ADF renderer (decision D11 of the converter change). On MR-4, the description ends with `**Screenshot:**` and then nothing.

Even someone who knew to look for the attachment could not fetch it with af.

The endpoints were checked against the live site on 2026-11-11 with the existing credentials, and the results are recorded in `design.md`. Both products serve attachment bytes to the same Basic auth af already uses.

## What Changes

- **List Jira attachments.** `af jira attachments <issue-key>` prints each attachment's ID, filename, size, type, date added and author. `--json` prints the raw attachment array.
- **Download Jira attachments.**
    - `af jira download <issue-key>` downloads every attachment of the issue.
    - `af jira download <id> [<id>…]` downloads the attachments with those IDs.
    - A call takes either one issue key or one or more attachment IDs, and never both. Jira attachment IDs are bare digits and unique across the site, so the two forms cannot be confused.
- **Download Confluence attachments.** `af confluence download <page-id>` downloads every attachment of the page, following pagination. `af confluence download <att-id> [<att-id>…]` downloads specific attachments. Confluence attachment IDs look like `att12345678`, and page IDs are bare digits.
- **Options shared by both `download` commands.**
    - `--name <pattern>` keeps only the attachments whose filename matches. `*` matches any run of characters and `?` one character, ignoring case.
    - `--out <dir>` writes into that directory, creating it when it is missing.
        - An existing file with the same name and size is skipped, because attachments never change once uploaded.
        - Any other existing file stops the command before anything is downloaded, unless `--force` is given.
    - `--out -` streams exactly one attachment to standard output.
    - `--json` prints the destination folder and one entry per file: ID, filename, path, size, type and status.
- **Default destination: a fresh temporary folder.** Without `--out`, each run creates a new, empty folder under the OS temp directory, named after its source (for example `af-jira-MR-4-Xy12Ab`). The command prints the folder's absolute path and each file's absolute path. Nothing lands in the working tree, so downloads never show up in `git status`, never get committed by accident, and never trigger an `af stop-hook` E2E run. To keep files, pass `--out`.
- **Attachments in `af jira get`.** The issue view gains an `Attachments (N)` table and a one-line hint naming `af jira download <key>`. `--json` output is unchanged, because it already carries `fields.attachment`.
- **ID column in `af confluence attachments`,** so a single attachment can be downloaded by ID.
- **One shared download helper, safe by construction.** `atlassian/lib/download.ts`:
    - turns untrusted attachment names into safe local filenames;
    - writes each file to an exclusively created temporary file, then renames it into place;
    - checks the byte count against the size Jira or Confluence reports;
    - follows redirects itself, sending credentials only to the configured Atlassian site;
    - runs at most 4 downloads at once.
- **Strict parsing.** `af jira attachments`, `af jira download` and `af confluence download` reject unknown options and malformed positional arguments, as the prose commands already do.
- Help text (`af jira --help`, `af confluence --help`) and the Jira and Confluence sections of `CLAUDE.md` document the new commands.

Explicitly **not** part of this change:

- Showing embedded images where they sit in a description or comment, and keeping them when an agent edits the text and runs `update`. Both are the follow-up change `round-trip-adf-media`, which changes the ADF converter.
- Deleting attachments, thumbnails, and listing the contents of archive attachments.
- Reworking the upload side (`addAttachment`'s hand-built multipart body).
- Resuming interrupted downloads with `Range`, and a persistent download cache.
- Bitbucket.

## Capabilities

### New Capabilities

<!-- None: the commands extend jira-command and confluence-command, and the shared helper is specified with the other shared Atlassian helpers. -->

### Modified Capabilities

- `jira-command`: new requirements for listing attachments, downloading attachments, the Attachments section of `af jira get`, and strict option checking on the two new subcommands.
- `confluence-command`: **Confluence attachment operations** gains an ID column in the attachment list. New requirements for downloading attachments and for strict option checking on `download`.
- `atlassian-shared-config`: a new requirement for downloading attachments to local files. It specifies the destination folder, filename sanitizing, collisions, existing files, the temporary-file-and-rename write, the size check, where credentials may be sent, concurrency, and streaming to standard output, once for both products.

## Impact

- **Code:**
    - `atlassian/lib/download.ts` (new): resolves the destination, assigns safe filenames, checks for existing files, and downloads with bounded concurrency. It uses Node APIs only (`node:fs`, `node:os`, `node:stream`), which Bun supports and which Vitest, running under Node, can exercise against a real temporary directory.
    - `atlassian/lib/request.ts`: exports its error-message parser, so download errors read like every other Atlassian error.
    - `utils/concurrency.ts` (new): `mapWithConcurrency`, moved out of `bitbucket/lib/client.ts`, which then imports it.
    - `jira/lib/types.ts`: `JiraAttachment`, moved from `client.ts` and given `thumbnail`, plus `attachment?: JiraAttachment[]` on `JiraIssueFields`.
    - `jira/lib/client.ts`: `getIssueAttachments(key)`, `getAttachment(id)` and the content URL for an attachment ID.
    - `jira/lib/formatters.ts`: an attachment list formatter, the Attachments section of `formatIssue`, and one byte-size formatter shared with the upload output.
    - `commands/jira.ts`: the `attachments` and `download` handlers, `--out` and `--force`, strict rules, help.
    - `confluence/lib/client.ts`: `getAllAttachments(pageId)`, which follows `_links.next`, and `getAttachment(id)`.
    - `confluence/lib/formatters.ts`: the ID column.
    - `commands/confluence.ts`: the `download` handler, `--name`, `--out` and a boolean `--force`, a strict rule, help.
    - `CLAUDE.md`.
- **APIs:**
    - Jira: `GET /rest/api/3/issue/{key}?fields=attachment`, `GET /rest/api/3/attachment/{id}`, and `GET /rest/api/3/attachment/content/{id}?redirect=false`. With `redirect=false`, Jira serves the bytes itself and reports errors in its usual JSON.
    - Confluence: `GET /wiki/api/v2/pages/{id}/attachments` (every page of results), `GET /wiki/api/v2/attachments/{id}`, and `GET /wiki{downloadLink}`, which answers with a 302 to a pre-signed `api.media.atlassian.com` URL.
- **Auth:** no new scopes. Read access to the issue or page is enough.
- **Rate limits:**
    - one metadata request per issue, or per page of Confluence attachments;
    - one metadata request per attachment ID given;
    - one request per Jira file, and two per Confluence file (the redirect).
- **Behaviour change:**
    - `af jira get` output gains a section.
    - `af confluence attachments` gains a column.
    - No JSON output changes.
- **Tests:**
    - `atlassian/lib/download.test.ts` (new): filename sanitizing, collisions (ignoring case), existing-file handling, the temporary-file write and rename, size mismatch, redirect handling and where credentials are sent, the 4-download limit, and standard output.
    - `jira/lib/client.test.ts` and a new `confluence/lib/client.test.ts`: the metadata calls and Confluence pagination.
    - `jira/lib/formatters.test.ts`: the attachment table and the `formatIssue` section.
    - `commands/jira.test.ts` and `commands/confluence.test.ts`: argument handling, strict rules and the download flow. Their client mock factories must include the new client functions.
- **Dependencies:** none. Matching `--name` is a few lines, and no glob library is added.
