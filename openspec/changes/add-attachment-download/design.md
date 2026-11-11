## Context

**Current state.**

- Upload exists on both products: `af jira attach <key> <file>` (`addAttachment`, a hand-built multipart POST) and `af confluence attach <page-id> <file>`. Neither product can download.
- `af confluence attachments <page-id>` lists the first page of a page's attachments (`--limit`, default 50), with filename, size and type but no ID.
- `getIssue` requests `?expand=renderedFields&fields=*all`, so `fields.attachment` is in every `af jira get` response. `JiraIssueFields` does not declare it, and `formatIssue` never reads it. The only Jira attachment formatter, `formatAttachments`, renders the result of an upload ("Attachments added to …").
- `JiraAttachment` is declared in `jira/lib/client.ts`, not in `types.ts`.
- A bounded-concurrency helper, `mapWithConcurrency`, exists but is private to `bitbucket/lib/client.ts`.
- `request.ts` has a private `parseErrorMessage` that understands the Jira, Confluence and Bitbucket error envelopes.

**Verified API behaviour** (live site, 2026-11-11, existing Basic auth, read-only):

| Request | Observed |
|---|---|
| Jira `GET /rest/api/3/attachment/content/{id}` | `303` to `https://api.media.atlassian.com/file/<uuid>/binary?token=…&client=…&dl=…&name=…`, a pre-signed URL |
| …the same, following the redirect | `200`, all 26,904 bytes, `Content-Disposition: attachment; filename="…"` |
| Jira `…/content/{id}?redirect=false` | `200` from the Jira site itself. `Content-Type: image/png;charset=UTF-8` (a charset appended to a binary type), `Content-Disposition: attachment; filename*=UTF-8''…;` |
| …with `Range: bytes=0-15` | `206`, 16 bytes |
| Jira `…/content/99999999?redirect=false` | `404`, `{"errorMessages":["The attachment with id '99999999' does not exist"],"errors":{}}` |
| Jira `GET /rest/api/3/attachment/{id}` | `id, self, filename, author, created, size, mimeType, properties, content, thumbnail`; `properties` was `{}` |
| Confluence search hits | Attachment IDs have the form `att<digits>`; page IDs are bare digits |
| Confluence `GET /wiki/api/v2/pages/{id}/attachments` | Each attachment carries `id, title, mediaType, fileSize, fileId, pageId, downloadLink, webuiLink, …`. `limit=250` is accepted, and `limit=251` is a 400 ("greater than the max allowed: 250"). `_links.next` is site-relative (`/wiki/api/v2/pages/{id}/attachments?limit=…&cursor=…`) and works when prefixed with the base URL |
| Confluence `GET /wiki{downloadLink}` | `302` to `https://api.media.atlassian.com/file/<uuid>/<name>?token=…&client=…&name=…`; following it gave `200` with exactly `fileSize` bytes |

In a local test, Bun 1.4.4's `fetch` dropped `Authorization` on a cross-origin redirect and kept it on a same-origin one. af's `bun` dependency is `>=1.1.0`, though, so that behaviour belongs to one runtime version, not to af.

**Constraints.**

- Attachment names are untrusted. Anyone who can attach a file can name it, including Jira Service Management customers through the portal, so `../../.zshrc` is a legal attachment name.
- Vitest runs under Node (`environment: 'node'`), so library code uses Node APIs. Bun implements them too.
- Agents are a primary consumer. Paths must be printed in full, and output must stay parseable.

## Goals / Non-Goals

**Goals:**

- Download one, some or all attachments of a Jira issue or a Confluence page, to a predictable place, with absolute paths printed.
- Make attachments discoverable from `af jira get`.
- Never write outside the chosen folder, never write through a planted file or symlink, and never leave a half-written file under a final name.
- Never send credentials anywhere except the configured Atlassian site.
- One download implementation for both products.

**Non-Goals:**

- Rendering embedded images inside descriptions and comments, and preserving them on `update`. That is change 2, `round-trip-adf-media`.
- Deleting attachments, thumbnails, and archive listings (`/attachment/{id}/expand/human`).
- Changing upload.
- Resumable downloads and a persistent cache.
- Confluence blog-post or space-level attachments. `download` takes page IDs and attachment IDs.
- Windows filename rules (reserved device names, trailing dots). af targets macOS and Linux.

## Decisions

### D1. Command shape: `attachments` and `download`

Jira gains `af jira attachments <issue-key>` (list) and `af jira download …`; Confluence gains `af confluence download …`. Upload stays `attach` on both. The user chose this shape on 2026-11-11, over the alternatives below.

| Alternative | Why not |
|---|---|
| A noun group (`af jira attachment list\|download\|add\|delete`) | Breaks the symmetry with `af confluence attachments` / `attach`, and makes `attach` an alias of something new |
| Overloading `attach` (`attach KEY` lists, `attach KEY --download` fetches) | Precedent exists (`comment`, `remote-link`), but `attach --download` reads backwards |

**Positional forms.** A `download` call takes exactly one of:

- one issue key (Jira: `^[A-Za-z][A-Za-z0-9_]*-\d+$`) or one page ID (Confluence: `^\d+$`), meaning every attachment there;
- one or more attachment IDs (Jira: `^\d+$`, which are unique across the site; Confluence: `^att\d+$`), meaning exactly those. Repeated IDs are downloaded once.

Mixing the forms, giving two keys or two page IDs, or giving anything that matches neither form is an argument error. The error names the argument and both accepted forms.

Positional filenames (`download MR-4 shot.png`) were considered and rejected. Filenames can contain spaces and look like IDs, and `--name` covers the need.

### D2. Default destination: a fresh temporary folder per run

Without `--out`, the command creates a folder with `fs.mkdtemp(join(os.tmpdir(), prefix))`. The prefix is:

- `af-jira-<KEY>-` for an issue key, in upper case;
- `af-confluence-<page-id>-` for a page ID;
- `af-jira-attachments-` or `af-confluence-attachments-` for a list of attachment IDs.

The folder is created only when at least one file will be written. It is not created for `--out -`, and not when nothing is selected.

| Alternative | Trade-off |
|---|---|
| A cache keyed by attachment ID (`~/.cache/artifex/…/attachments/<id>/<name>`) | Re-runs would be free and names could never collide, because attachments never change. The user preferred a fresh folder (2026-11-11) |
| `./<KEY>/` in the working directory | Readable without permission prompts, but inside a repository the files are untracked: they show up in `git status`, can be committed by accident, and make `af stop-hook` run E2E |
| The working directory, flat (`curl -O` style) | Needs a clobbering policy for every run, in the place users keep their own files |

The fresh folder starts empty, so the default path needs no overwrite rules at all. An empty folder per run is also the right container for files that anyone could have uploaded. The costs are listed under Risks.

### D3. `--out <dir>` and existing files

- `--out <dir>` creates the directory when it is missing (`mkdir -p`).
- Before downloading anything, the command inspects every final path with `lstat`:
    - nothing there: download;
    - a regular file whose size equals the attachment's size: skip it with status `skipped`. An attachment's content never changes for a given ID (Jira and Confluence have no endpoint that replaces it), so the same name and size almost always means the same file;
    - anything else (a different size, a directory, a symlink, any other non-regular file): a conflict.
- Conflicts are reported together, one path per line, and the command exits 1 having downloaded nothing.
- `--force` writes every selected file and replaces whatever is at its path, same-size files included. A directory at the path is still an error, because a rename cannot replace a directory.
- `--force` without `--out <dir>` is an argument error. In the fresh folder, and with `--out -`, there is nothing to force.

Checking before any download makes conflicts all-or-nothing: a run never stops halfway through because file 7 of 12 already existed.

### D4. Local filenames

**Sanitizing.** Each attachment's metadata name (Jira `filename`, Confluence `title`) becomes a single path component:

1. Normalize it to Unicode NFC.
2. Replace `/`, `\`, NUL and the other control characters (U+0001–U+001F, U+007F) with `_`.
3. If the result is empty, `.` or `..`, use `attachment-<id>`.
4. If the result is longer than 255 UTF-8 bytes, shorten the stem and keep the extension: the text after the last `.`, when that is at most 16 bytes. Never split a multi-byte character.

Leading dots are kept. A single component inside af's own folder cannot escape it, and `.env` should stay `.env`.

| Alternative | Why not |
|---|---|
| `path.basename(name)` | Silently drops everything before a `/` (`2024/report.pdf` would become `report.pdf`), and treats `\` differently on POSIX and Windows |
| Percent-encoding | Safe, but unreadable for the common case |

**Collisions within a run.** Attachments are processed in ascending numeric ID order: the Jira ID, or the digits of a Confluence `att…` ID. Names are compared after NFC normalization and lowercasing, because the default macOS filesystem ignores case, so `Shot.png` and `shot.png` would land on the same file. The first attachment keeps its name. Each later duplicate gets `-<id>` inserted before its extension (`screenshot.png`, `screenshot-10047.png`), and a counter (`-<id>-2`, …) if even that is taken. The rule is deterministic, so the same selection always produces the same names.

### D5. Writing: exclusive temporary file, size check, rename

For each file, the helper:

1. creates a temporary file in the destination directory, named `.af-<random>.part` and opened with flags `wx` (`O_CREAT | O_EXCL`). Exclusive creation fails on any existing path, including a symlink, so nothing planted in the folder is reused or followed;
2. streams the response body into it (`stream.pipeline(Readable.fromWeb(body), createWriteStream(tmp, { flags: 'wx' }))`), never buffering a whole file in memory;
3. compares the bytes written with the metadata size (Jira `size`, Confluence `fileSize`). On a mismatch, it deletes the temporary file and reports `expected <n> bytes, received <m>`;
4. renames the temporary file onto the final name. A rename within one directory is atomic, and it replaces a file or symlink at the destination rather than writing through it.

On any error, the temporary file is deleted. So a final name holds either a complete, size-checked file or whatever was there before.

### D6. URLs, redirects and credentials

- **URLs.** Download URLs always start with the configured base URL.
    - Jira's is built from the ID: `${base}/rest/api/3/attachment/content/${id}?redirect=false`. The `content` URL in the response is not used.
    - Confluence's is `${base}/wiki${downloadLink}`. `downloadLink` must start with `/`; otherwise the attachment fails with an error, and nothing is fetched for it.
- **Redirects** are followed by the helper itself (`redirect: 'manual'`, at most 5 hops, each `Location` resolved against the current URL):
    - `Authorization` is sent only while the URL's origin equals the base URL's origin;
    - a hop to any other origin, such as the pre-signed `api.media.atlassian.com` URL, goes out without credentials. Its token authorizes it;
    - more than 5 hops is an error.
- **Why manual:** whether `fetch` strips `Authorization` across origins is runtime behaviour. Bun 1.4.4 does, and the WHATWG spec requires it, but af allows any Bun `>=1.1.0`. Following redirects by hand makes the guarantee af's own.
- **Why `redirect=false` for Jira:** one request, served by the site whose credentials it carries, with errors in Jira's JSON envelope (`errorMessages`), which the shared parser already understands. Both were verified on 2026-11-11, along with `Range` support for a later resume feature.
- **Confluence** has no equivalent parameter, and its 302 is followed as above.
- **Errors.** A non-2xx response becomes `AtlassianHttpError(message, status)`, with the message from `request.ts`'s parser, now exported. A media-host body that is not JSON falls back to `HTTP <status>: <statusText>`.

### D7. Two phases, bounded concurrency

1. **Metadata.**
    - Jira issue: `GET /rest/api/3/issue/{key}?fields=attachment`.
    - Jira IDs: `GET /rest/api/3/attachment/{id}` each.
    - Confluence page: `GET /wiki/api/v2/pages/{id}/attachments?limit=250`, then each `_links.next` until there is none.
    - Confluence IDs: `GET /wiki/api/v2/attachments/{id}` each.

    Any metadata failure (a 404 for one ID, say) exits 1 before anything is downloaded or any folder is created.
2. **Download.** Files are independent. A failed file does not cancel the others. The run reports every file's outcome and exits 1 if any failed. Completed files stay where they are.

Both phases run at most 4 requests at once, through `mapWithConcurrency`. It moves from `bitbucket/lib/client.ts` to `utils/concurrency.ts`, and the Bitbucket client imports it from there. The 4 matches `af bb … --checks`; there are few files per issue, and the ceiling keeps af well inside Atlassian's rate limits.

### D8. Selection: `--name` and empty results

- `--name <pattern>` matches the whole metadata name, ignoring case. `*` matches any run of characters and `?` exactly one; every other character is literal. The pattern compiles to an anchored regular expression with everything else escaped.
- No glob library is added, and alternation (`*.{png,jpg}`) is not supported. It applies to both positional forms.
- An issue or page with no attachments prints a notice on standard error and exits 0. The user asked for "everything", and everything is nothing; an agent should not treat that as a failure to retry. No folder is created.
- A `--name` that matches nothing exits 1, because it is most likely a typo. The message lists the available filenames, so an agent can correct the pattern without another call.

### D9. Output

- **Human.** One header line, `Downloaded <n> attachment(s) from MR-4 to <absolute folder>`, then one line per file: ID, size, then the absolute path last, so paths with spaces stay intact. Skipped files are marked `(already present)`. Failures go to standard error with their reason.
- **`--json`.** The output object is `{ "directory": "<abs>", "files": [{ "id", "filename", "path", "size", "mimeType", "status", "error"? }] }`.
    - `filename` is the original metadata name, and `path` is the absolute local path.
    - `status` is `downloaded`, `skipped` or `failed`.
- **`--out -`.**
    - Exactly one attachment must be selected after filtering; otherwise it is an error before any download, giving the count.
    - The bytes are the only thing written to standard output.
    - Nothing can be withdrawn once written, so the byte count is checked at the end. A mismatch is reported on standard error, with exit 1.
    - `--json` with `--out -` is an argument error.
- Notices and warnings always go to standard error, so standard output stays parseable in every mode.

### D10. Attachments in `af jira get` and `af jira attachments`

- **Table.** `formatIssue` adds `## Attachments (<n>)` after Remote Links and before Custom Fields, with the columns `ID | Filename | Size | Type | Added`.
    - `Added` is the existing date format and the author's display name.
    - Under the table, one line: ``Download: `af jira download <KEY>` `` (or by ID).
    - The section is omitted when there are no attachments.
- **`af jira attachments <key>`** prints the same table under `# Attachments on <KEY> (<n>)`, or `No attachments.`. `--json` prints the raw `fields.attachment` array.
- **Table cells.** Filenames are untrusted, so a `|` in a cell is escaped as `\|` and control characters display as `_`, which keeps a name from breaking the table.
- **Byte sizes** come from one formatter (`B` / `KB` / `MB` with one decimal), now shared by the upload output, the new table and Confluence.

Leaving `get` unchanged, with listing only in `attachments`, was rejected: discoverability is the point. An agent that never sees attachments never asks for them.

### D11. Confluence attachment list gains an ID column

`af confluence attachments` renders `| ID | Filename | Size | Type |`. `--limit` keeps its meaning (one page of results). Only `download` drains every page.

### D12. Client and type additions

- `jira/lib/types.ts`:
    - `JiraAttachment` (moved from `client.ts`, with `thumbnail?: string` added). `client.ts` re-exports the type, so existing imports keep working;
    - `attachment?: JiraAttachment[]` on `JiraIssueFields`.
- `jira/lib/client.ts`:
    - `getIssueAttachments(key)` returns `fields.attachment ?? []`;
    - `getAttachment(id)`;
    - `attachmentContentUrl(id)`.
- `confluence/lib/types.ts`: `fileId?` and `pageId?` on `ConfluenceAttachment`. `fileId` is also what change 2 uses to link media nodes to attachments.
- `confluence/lib/client.ts`:
    - `getAllAttachments(pageId)` follows `_links.next`, prefixing the base URL;
    - `getAttachment(attId)`.
- `atlassian/lib/download.ts` exports:
    - the pure planning steps: sanitize, assign names, match `--name`, classify positionals;
    - `downloadAttachments(plan, options)`, which does the I/O.

    Keeping the steps pure lets them be tested without a filesystem or network. The I/O path is tested against a real temporary directory with `fetch` mocked.

### D13. Strict parsing

- **Jira.**
    - `strictRule('attachments', [], 1)`;
    - `strictRule('download', ['--name', '--out', '--force'], Number.POSITIVE_INFINITY)`;
    - `--force` joins `BOOLEAN_OPTIONS`.
- **Confluence.**
    - A `download` entry in `STRICT_RULES` with `--name`, `--out`, `--force` and `--json`, and unbounded positionals;
    - its parser gains a set of boolean options (`--json`, `--force`) in place of the `--json` special case.
- **Shape checks.** Unbounded positionals leave the positional-shape checks (D1) to the handler. They and the D3/D9 argument errors (`--force` without a directory, `--json` with `--out -`) run before any request.
- **`--out -`** needs no parser change, because an option takes the next argument whatever it is.
- **`af confluence attachments`** stays lenient. Changing it is out of scope.

### D14. Documentation

- **Help:**
    - `af jira --help` lists `attachments` and `download`, adds a `DOWNLOAD OPTIONS` section and examples, and adds both subcommands to the sentence naming the commands that reject unknown options;
    - `af confluence --help` does the same for `download`.
- **`CLAUDE.md`:**
    - the Jira section describes listing and downloading, the fresh-folder default and `--out`;
    - the Confluence section describes `download`.

## Risks / Trade-offs

- **Every run without `--out` downloads again and prints a new path.** Accepted with the fresh-folder choice. Agents use the printed paths, and anyone who wants files kept passes `--out`.
- **Temporary folders pile up.** The OS clears its temp directory eventually (macOS purges unused files under `/var/folders/…/T`, and many Linux systems clear `/tmp` at boot). The folder names start with `af-`, so they are easy to find and remove.
- **Claude Code may ask before reading a file outside the project.** Accepted by the user. `--out` puts files inside the project when that is wanted.
- **`--out` skips a different file with the same name and size.** Rare, because two different attachments would need the same name and the same byte count. `--force` downloads a fresh copy.
- **`redirect=false` makes Jira proxy the bytes,** which may be slower than Atlassian's media CDN for very large files. Typical attachments (screenshots, logs) are small. If it matters, Jira can drop `redirect=false`, and the helper already follows the 303 safely (D6).
- **A killed process (`kill -9`, power loss) can leave a `.af-*.part` file** in an `--out` directory. The prefix and suffix make it recognizable, and a final name never holds a partial file.
- **Ignoring case when checking collisions renames files on case-sensitive filesystems that would not have clashed.** Harmless, and the same selection always gives the same names.
- **`--name` has no alternation.** Run the command twice, or widen the pattern. A richer syntax can come later without breaking this one.
- **Confluence `att…` IDs are assumed to be digits after `att`** (as observed). Anything else is rejected by the positional check, with an error naming the expected form.

## Migration Plan

Additive. Two existing outputs change: `af jira get` gains a section, and `af confluence attachments` gains a column. Rollback is a revert.

## Open Questions

None blocking. Handling blog-post attachments and filename positionals is deferred until someone asks for it.

<!-- cspell:words CREAT -->
