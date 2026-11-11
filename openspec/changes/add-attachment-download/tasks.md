## 1. Shared foundations

- [x] 1.1 Move `mapWithConcurrency` from `bitbucket/lib/client.ts` to a new `utils/concurrency.ts`, unchanged (input order kept; stops starting new calls after the first rejection). Import it in `bitbucket/lib/client.ts`. Add `utils/concurrency.test.ts`: at most N calls in flight, results in input order, and no new call started after a rejection. The existing Bitbucket tests must pass unchanged.
- [x] 1.2 Export the error-message parser from `atlassian/lib/request.ts` (rename `parseErrorMessage` to an exported `errorMessageFrom(response)`), with no behaviour change. `atlassian/lib/request.test.ts` must pass unchanged.
- [x] 1.3 Add `utils/format-bytes.ts` with `formatBytes(n)` (`B`, `KB` or `MB` with one decimal, exactly as the upload formatters print today), plus tests: `1023 B`, `37.7 KB` for 38,612 bytes, `26.3 KB` for 26,904 bytes, MB values.

## 2. Download helper: pure planning (`atlassian/lib/download.ts`)

- [x] 2.1 Define the types: a `DownloadItem` (`id`, metadata `name`, `size`, `mimeType`, absolute content `url`) and a per-file result (`id`, `filename`, `path`, `size`, `mimeType`, `status: 'downloaded' | 'skipped' | 'failed'`, `error?`).
- [x] 2.2 `sanitizeFilename(name, id)` (design D4): NFC; replace `/`, `\`, NUL and U+0001–U+001F, U+007F with `_`; `attachment-<id>` for an empty, `.` or `..` result; shorten names over 255 UTF-8 bytes in the stem, keeping an extension of at most 16 bytes, never splitting a character.
- [x] 2.3 `assignLocalNames(items)` (design D4): sort by numeric ID (the digits of `att…` for Confluence). Compare names after NFC and lowercasing. Keep the first; insert `-<id>` before the extension of each later duplicate; add `-2`, `-3` … when that is taken too. Return the names in a map keyed by ID.
- [x] 2.4 `compileNamePattern(pattern)` (design D8): an anchored, case-insensitive matcher where `*` is any run, `?` is one character, and everything else is literal (escape regular-expression special characters).
- [x] 2.5 Add `atlassian/lib/download.test.ts` for the pure functions:
    - `../../.zshrc` gives `.._.._.zshrc`, and `a\b` gives `a_b`;
    - a newline or NUL becomes `_`;
    - `..`, `.` and an empty name give `attachment-<id>`;
    - `e` followed by U+0301 becomes `é` (NFC);
    - a 300-character name ending `.png` is shortened to 255 bytes or fewer and still ends `.png`;
    - multi-byte characters at the cut are kept whole, and an extension longer than 16 bytes is not preserved;
    - collisions: `Shot.png` (10046) and `shot.png` (10047) give `Shot.png` and `shot-10047.png`; three duplicates; a literal `shot-10047.png` already taken gives the counter;
    - patterns: `*.png` matches `b.PNG`; `?` matches exactly one character; `a+b(1).png` matches only itself; `*.png` does not match `x.png.txt`.

## 3. Download helper: I/O

- [x] 3.1 Destination (design D2): a fresh `fs.mkdtemp(join(os.tmpdir(), prefix))`, or `--out <dir>` created with `{ recursive: true }`. Create it only once at least one file will be written.
- [x] 3.2 Pre-flight check for `--out <dir>` (design D3), using `lstat`:
    - a regular file of the same size is `skipped`;
    - any other entry is a conflict;
    - with `force`, regular files and symlinks are replaced, but a directory is always an error;
    - all conflicts are collected and thrown as one error, one path per line, before any download.
- [x] 3.3 `fetchFollowingRedirects(url, { authorization, baseOrigin })` (design D6):
    - `redirect: 'manual'`, at most 5 hops, each `Location` resolved against the current URL;
    - `Authorization` only when the URL's origin equals `baseOrigin`;
    - a non-2xx response becomes `AtlassianHttpError(errorMessageFrom(response), status)`.
- [x] 3.4 The exclusive write (design D5):
    - open `.af-<random>.part` in the destination with `createWriteStream(tmp, { flags: 'wx' })`;
    - `stream.pipeline(Readable.fromWeb(body), …)`;
    - count bytes; on a mismatch with the metadata size, throw `expected <n> bytes, received <m>`;
    - `fs.rename` onto the final path;
    - delete the temporary file on every error path.
- [x] 3.5 `downloadAttachments(items, options)`:
    - options: `prefix`, `out?`, `force?`, `authorization`, `baseOrigin`, an injectable `stdout` writable;
    - run the downloads through `mapWithConcurrency(…, 4, …)`, where each file's function catches its own error and resolves to a `failed` result, so one failure never stops the rest;
    - return `{ directory, files }`;
    - for `out === '-'`, require exactly one item (error giving the count otherwise), stream its bytes to `stdout` with no temporary file, rename or folder, and count them. A count that differs from the metadata size is reported on standard error with exit 1, because bytes already written cannot be withdrawn.

    Note (review fix): when every item carries an `error`, no file is written, so no folder is created (neither a fresh one nor `--out`); the summary then has `directory: null`, and each file has `path: null`.
- [x] 3.6 Extend `atlassian/lib/download.test.ts` with I/O tests against a real temporary directory and a mocked `fetch`. Cover:
    - two calls create two different folders, and no folder is created when nothing is selected;
    - same-size skip, the conflict list with nothing downloaded, and `force` replacing a file;
    - a symlink at the final path, with `force`, becomes a regular file and its target is unchanged;
    - a directory at the final path is an error even with `force`;
    - a short body leaves neither the final file nor any `.af-*.part`;
    - a cross-origin redirect is requested without `Authorization`, and a same-origin redirect keeps it;
    - 6 redirects is an error;
    - with 12 items and deferred responses, an in-flight counter never exceeds 4;
    - one failed file gives `failed` with `error` while the others are `downloaded`;
    - `out: '-'` writes exactly the bytes to the injected writable and creates no folder.

## 4. Jira client, types and formatters

- [x] 4.1 In `jira/lib/types.ts`:
    - add `JiraAttachment` (moved from `client.ts`), with `thumbnail?: string` added;
    - add `attachment?: JiraAttachment[]` to `JiraIssueFields`.

    In `jira/lib/client.ts`, re-export the type and update the import in `jira/lib/formatters.ts`.
- [x] 4.2 In `jira/lib/client.ts`, add:
    - `getIssueAttachments(key)`: `GET /issue/{key}?fields=attachment`, returning `fields.attachment ?? []`;
    - `getAttachment(id)`: `GET /attachment/{id}`;
    - `attachmentContentUrl(id)`: `${base}/rest/api/3/attachment/content/${id}?redirect=false`.
- [x] 4.3 Add `jira/lib/client.test.ts` cases:
    - the two request URLs;
    - an empty array when the response has no `attachment` field;
    - the content URL built from the base URL and the ID, ignoring any `content` URL.
- [x] 4.4 In `jira/lib/formatters.ts` (design D10):
    - replace the inline size expression in `formatAttachments` with `formatBytes` (same output);
    - add `formatAttachmentTable(attachments)` (`ID | Filename | Size | Type | Added`; `|` as `\|`, control characters as `_`; Added = the existing date format plus the author's display name);
    - add `formatAttachmentList(key, attachments)` (`# Attachments on <KEY> (<n>)`, or `No attachments.`);
    - in `formatIssue`, add the `## Attachments (<n>)` section after Remote Links and before Custom Fields, followed by ``Download: `af jira download <KEY>` ``, and omit it when there are none.
- [x] 4.5 Add `jira/lib/formatters.test.ts` cases:
    - a row reading `10113 | mobile-modules.png | 37.7 KB | image/png`;
    - `a|b.txt` rendered as `a\|b.txt`;
    - a control character rendered as `_`;
    - in `formatIssue`, `## Attachments` lies between `## Remote Links` and `## Custom Fields`, and the hint names the key;
    - no section without attachments;
    - the upload output (`formatAttachments`) is unchanged.

## 5. Jira command

- [x] 5.1 In `commands/jira.ts`:
    - add `out?: string` and `force?: boolean` to `JiraOptions` (`name` already exists);
    - add `'--force'` to `BOOLEAN_OPTIONS`;
    - add `strictRule('attachments', [], 1)` and `strictRule('download', ['--name', '--out', '--force'], Number.POSITIVE_INFINITY)` to `STRICT_RULES`.
- [x] 5.2 Add the `attachments` case:
    - a usage error without a key;
    - otherwise `client.getIssueAttachments(key)`, then `fmt.formatAttachmentList`, or the raw array with `--json`.
- [x] 5.3 Add the `download` case, in this order, so that every argument error comes before any request:
    1. Classify the positionals (design D1): one key, or one or more IDs, deduplicated. Name the offending argument in any error.
    2. Reject `--force` without `--out <dir>`, and `--json` with `--out -`.
    3. Fetch the metadata: `getIssueAttachments(key)`, or `getAttachment(id)` for each ID through `mapWithConcurrency(…, 4, …)`. A failure exits 1, with nothing created.
    4. An empty issue prints a notice on standard error and exits 0.
    5. Apply `--name`. No match prints the pattern and the available filenames, and exits 1.
    6. Build the `DownloadItem`s with `client.attachmentContentUrl(id)`, then call `downloadAttachments` with the prefix `af-jira-<KEY>-` (in upper case) or `af-jira-attachments-`, the shared auth header and the base URL's origin.
    7. Print the human summary (folder, then `<id>  <size>  <path>`, with `(already present)` for skips, and failures on standard error) or the JSON object. Exit 1 if any file failed.

    Note (review fix): with `--json`, an issue without attachments also prints `{"directory": null, "files": []}` on standard output; the notice stays on standard error and the exit code stays 0 (6.5 does the same for a page).
- [x] 5.4 Help text:
    - list `attachments <issue-key>` and `download <issue-key> | <id>…` under COMMANDS;
    - add a `DOWNLOAD OPTIONS` section (`--name <pattern>`, `--out <dir|->`, `--force`) explaining the fresh temporary folder default;
    - add examples (`af jira download MR-4`, `--name '*.png'`, `af jira download 10046 --out - | less`);
    - add `attachments` and `download` to the sentence listing the commands that reject unknown options.
- [x] 5.5 Extend `commands/jira.test.ts`:
    - add `getIssueAttachments`, `getAttachment` and `attachmentContentUrl` to the client mock factory;
    - mock `downloadAttachments` from `atlassian/lib/download.ts` and assert the items, prefix and options it receives;
    - add rows for the two new rules to the strict-rule table, or an equivalent table;
    - cover:
        - `--nam` suggesting `--name`;
        - `attachments MR-4 MR-5` rejected;
        - `--force=yes` rejected;
        - `download MR-4 10046` and `download screenshot.png` rejected with no client call;
        - `--force` without `--out`, and `--json` with `--out -`, rejected with no client call;
        - an empty issue: notice, exit 0, helper not called;
        - an unmatched `--name`: error listing names, exit 1;
        - an unknown ID: exit 1 and the helper not called;
        - JSON output shape;
        - help containing the new commands and options.

## 6. Confluence

- [x] 6.1 In `confluence/lib/types.ts`, add `fileId?: string` and `pageId?: string` to `ConfluenceAttachment`.
- [x] 6.2 In `confluence/lib/client.ts`, add:
    - `getAllAttachments(pageId)`: `/pages/{id}/attachments?limit=250`, then `getBaseUrl()` + each `_links.next` until a response has none, concatenating `results`;
    - `getAttachment(attId)`: `GET /attachments/{id}`.
- [x] 6.3 Add `confluence/lib/client.test.ts` with a mocked `fetch`:
    - pagination follows two `next` links and stops;
    - `next` paths are prefixed with the base URL exactly once;
    - the `getAttachment` URL.
- [x] 6.4 In `confluence/lib/formatters.ts`, render `| ID | Filename | Size | Type |`, using `formatBytes`. Add `confluence/lib/formatters.test.ts` for the ID column.
- [x] 6.5 In `commands/confluence.ts`:
    - add `name`, `out` and `force` to `ConfluenceOptions`;
    - replace the `--json` special case in `parseArgs` with a set of boolean options (`--json`, `--force`);
    - add a `download` entry to `STRICT_RULES` (`--name`, `--out`, `--force`, `--json`; unbounded positionals);
    - add the `download` case, mirroring 5.3, with positionals classified as page ID `^\d+$` or attachment IDs `^att\d+$`, the prefix `af-confluence-<page-id>-` or `af-confluence-attachments-`, and the URL `${base}/wiki${downloadLink}`. An attachment whose `downloadLink` does not start with `/` fails with an error naming it.
- [x] 6.6 Update the Confluence help: `download` under ATTACHMENT COMMANDS, a `DOWNLOAD OPTIONS` section, examples, and `download` in the sentence listing the commands that reject unknown options.
- [x] 6.7 Extend `commands/confluence.test.ts`:
    - add `getAllAttachments` and `getAttachment` to the client mock factory;
    - mock `downloadAttachments`;
    - cover:
        - `--outt` suggesting `--out`;
        - `--force=yes` rejected;
        - `download 12345 att111` rejected;
        - an empty page: notice, exit 0;
        - a `downloadLink` that does not start with `/` failing that attachment;
        - `--json` accepted;
        - the help text.

## 7. Documentation

- [x] 7.1 Update the Jira section of `CLAUDE.md`: `af jira attachments`, `af jira download` (positional forms, `--name`, `--out <dir|->`, `--force`, the fresh temporary folder default and why: nothing in the working tree, no stop-hook run), and the Attachments section of `af jira get`.
- [x] 7.2 Update the Confluence section of `CLAUDE.md`: `af confluence download` and the ID column of `attachments`.
- [x] 7.3 Add any new words flagged by `bun run spell:check` (for example `mkdtemp`) to `.cspell.json`.

## 8. Verification

- [x] 8.1 Run `bun run format:check`, `bun run lint`, `bun run spell:check` and `bun run test`. Use `bun run test` (Vitest), never `bun test`. All must pass.
- [x] 8.2 Run `npm pack --dry-run` and confirm that `atlassian/lib/download.ts`, `utils/concurrency.ts` and `utils/format-bytes.ts` are in the tarball, and that no `*.test.ts` is.
- [x] 8.3 Smoke test against the live site with read-only commands, using a scratch `--out` directory outside the repository:
    - `af jira attachments MR-10`;
    - `af jira get MR-4` shows `## Attachments (1)`;
    - `af jira download MR-10` prints a fresh `af-jira-MR-10-…` folder with both PNGs;
    - `af jira download MR-10 --out <scratch>` twice: the second run marks both `(already present)`;
    - `af jira download 10046 --out - | file -` reports PNG image data;
    - `af jira download MR-10 --name '*.pdf'` exits 1 and lists both names;
    - `af confluence download <page-id>` for a page with attachments, and `af confluence download <att-id> --out -`.

    Record the results in this task.

    Results (2026-11-11, `bun main.ts` from the working tree, Bun 1.4.4, live site, read-only):

    - `af jira attachments MR-10`: `# Attachments on MR-10 (2)`, with rows `10113 | mobile-modules.png | 37.7 KB | image/png` and `10115 | mobile-property-settings.png | 37.8 KB | image/png`, each with the date added and the author.
    - `af jira get MR-4`: `## Attachments (1)` after Description and before Custom Fields (MR-4 has no remote links), the row `10046 | image-20251217-080021.png | 26.3 KB | image/png`, then the `Download: af jira download MR-4` hint.
    - `af jira download MR-10`: a fresh `…/T/af-jira-MR-10-TZFJmK` (mode 0700) holding both PNGs at exactly 38,612 and 38,750 bytes, and no `.part` file.
    - `af jira download MR-10 --out <scratch>` twice: the first run downloaded both; the second printed `Downloaded 0 attachment(s)` with both lines marked `(already present)` (with `--json`: both `skipped`). After one file was shrunk, a run without `--force` reported the conflict, exited 1 and downloaded nothing; `--force` then replaced the file at its full size.
    - `af jira download 10046 --out - | file -`: `PNG image data, 1916 x 155`. Redirected to a file, standard output held exactly 26,904 bytes; standard error was empty, and no folder was created.
    - `af jira download MR-10 --name '*.pdf'`: exit 1, listing `mobile-modules.png` and `mobile-property-settings.png`; no folder was created.
    - Also checked: `af jira download MR-1 --out <scratch>` wrote all 12 files, every size matching; `af jira download 10046 99999999` exited 1 with `The attachment with id '99999999' does not exist`, and created no folder.
    - Confluence page 15663283, found with the read-only CQL search: `af confluence attachments 15663283` showed the ID column (`att15663292`, …); `af confluence download 15663283` wrote its 4 SVG files to a fresh `af-confluence-15663283-…`; `af confluence download att15663313 --out -` streamed 2,072 bytes, identical to the file from the page download, with empty standard error and no folder.
    - Redirects, traced through a wrapped `fetch`: Confluence answered 302 (credentials sent) and `api.media.atlassian.com` answered 200 with no `Authorization` header. Jira with `?redirect=false` answered 200 from the site in one request; without it, Jira's 303 was followed to the media host without credentials.
    - The scratch directory and the fresh `af-jira-*` and `af-confluence-*` folders were deleted afterwards.

<!-- cspell:words outt -->
