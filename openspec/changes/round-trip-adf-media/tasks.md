## 1. Spike: media nodes on scratch content (blocks groups 4, 6 and 7)

- [x] 1.1 Confirm the prerequisites. If any is missing, stop and ask the user. Do not skip the spike without the user's explicit agreement.
    - `add-attachment-download` is implemented: this change uses `getAllAttachments` and `ConfluenceAttachment.fileId`.
    - A Jira project and a Confluence space where scratch issues and pages may be created and deleted, named by the user. Never use MR, and never touch existing issues or pages.
    - A scratch Jira issue created for the spike, with a small PNG attached through the API (`af jira attach`). Its media UUID is the UUID in the `Location` of `GET /rest/api/3/attachment/content/{id}`, with the redirect not followed (verified on 2026-11-12). Record the issue key, the attachment ID and the UUID.
    - Result (2026-11-12): `getAllAttachments` and `fileId` are on `master`. The user approved project AM and the personal space `~5fcf7df29b5eed0076bf1e64` on 2026-11-12. Scratch issue AM-16 (id 10829) got a synthetic 16×16 PNG as attachment 10148 (`spike-red.png`); the content endpoint answered 303 with `…/file/ef68423c-1ee8-41f5-a978-f5069b2492cd/binary`.
- [x] 1.2 Jira (design D9, steps a to e, with b first). Send raw PUTs with the same credentials as af, from a scratch script kept outside the repository. After each step, record the HTTP status, the stored ADF (`GET …?fields=description`), and whether the image renders (the `renderedFields` HTML has an `<img>`, or check the UI):
    - b. embed the uploaded file as `mediaSingle { layout: "center" }` > `media { type: "file", id, collection: "" }` (also try `mediaInline { type: "file", id, collection: "" }` in a paragraph). If Jira rejects it, stop and ask for an image pasted through the UI;
    - a. read the stored description back and send it unchanged;
    - c. remove the node, then check that the attachment is still in `fields.attachment`;
    - d. create a second scratch issue whose description holds the same node;
    - e. duplicate the node, `occurrenceKey` included if the original has one.
    - Results (2026-11-12, AM-16 and AM-18):
        - b: 204. Stored exactly as sent; `renderedFields` has `<img … data-attachment-name="spike-red.png" data-media-services-id="ef68423c-…">`. The `mediaInline` (204) is stored with its attributes reordered and renders as an attachment link; a default `mediaGroup` (204) renders too.
        - a: 204. Resending the stored description gives a byte-identical description, still rendered. MR-4-shaped attributes (`align-start`, `width: 694`, `widthType: "pixel"`, `alt`, `width: 1916`, `height: 155`) plus a caption with a bold mark: 204, stored with the same values.
        - c: 204. Attachment 10148 stayed in `fields.attachment` (checked again minutes later).
        - d: rejected. Creating a second issue with the node: 400 `description: We don't recognise the format of a file you added or the data in it. Remove and try again.` (no issue was created; the key AM-17 was consumed and does not exist). Putting it into a plain second issue, AM-18: 400 `ATTACHMENT_VALIDATION_ERROR`; so did a comment on AM-18 and a UUID that names no file. A comment on AM-16 holding its own file: 201. Jira accepts only media of the issue's own attachments, and rejects the whole write otherwise.
        - e: 204 with and without a shared `occurrenceKey`; both copies render. Jira drops `occurrenceKey` on store, even on a single node.
- [x] 1.3 Confluence (design D9):
    - create a scratch page (`af confluence create --space <space> --title "spike: media" --body "spike"`);
    - attach a PNG (`af confluence attach <page-id> <file>`) and read its `fileId` from `GET /wiki/api/v2/pages/<page-id>/attachments`;
    - with raw PUTs (incrementing the version), embed it with `collection: "contentId-<page-id>"` and, separately, with `collection: ""`;
    - copy the node to a second scratch page;
    - remove the node, and check that the attachment stays;
    - duplicate the node.
    - Results (2026-11-12, pages 81559553 and 81723400 in `~5fcf7df29b5eed0076bf1e64`; attachment att81592321 `spike-blue.png`, `fileId` `21a63bef-8b38-4aac-99f9-a394dac6e584`):
        - `contentId-81559553`: 200, renders. Confluence adds `width`/`height` (16) to `media` and `width: 16, widthType: "pixel"` to `mediaSingle`.
        - `""`: 200, renders. Confluence rewrites the collection to `contentId-81559553` and adds the same sizes. A default `mediaInline` is stored as `{ id, collection: "contentId-81559553" }`, without `type`; a default `mediaGroup` is stored with sizes and the collection.
        - Resending the stored body unchanged: 200. The read right after a save sometimes carries `__fileName`, `__fileSize` and `__fileMimeType` on `media`, which later reads do not have; they are not in the ADF schema, and a resend without them is accepted.
        - Copy to page 81723400 (no attachments): 200 and renders from page 1's attachment, both as stored and with `collection: ""` (Confluence resolves `contentId-81559553`). A UUID that names no file: 200, but the stored `id` becomes `UNKNOWN_MEDIA_ID` (a broken embed).
        - Removing the node: the attachment stays.
        - Duplicating it with a shared `occurrenceKey`: 200, both render; Confluence drops `occurrenceKey`.
- [x] 1.4 Record the results:
    - answer each Open Question in `design.md`, with the date and the scratch keys and IDs;
    - settle the defaults for new nodes per product (design D3), the `occurrenceKey` rule (design D4), the warning wording (design D7: "the attachment is still on the issue/page" only if step c confirmed it), and whether UUIDs that are not found should warn (design Risks).

    If a product rejects the D3 defaults, write down the fallback chosen (adjusted defaults, or text for UUIDs that are not found on create paths) before group 4.
    - Settled (2026-11-12), recorded in design Open Questions, D4, D6, D7 and Risks:
        - D3's defaults stand for both products, with no fallback. Confluence's collection for new nodes stays `""`.
        - `occurrenceKey` is copied to every occurrence, like any other attribute.
        - D7 keeps "The attachment is still on the issue" / "on the page": step c confirmed it on both products.
        - UUIDs that are not found get no warning. Jira rejects a file that is not the issue's own with a 400 and writes nothing, so `af jira create` cannot embed an existing file; Confluence renders copies. The help text says so.
- [x] 1.5 Clean up: delete the scratch issues and pages (`af jira delete`, `af confluence delete`).
    - Done (2026-11-12): AM-16 and AM-18 deleted (`af jira delete`; both now answer "Issue does not exist"). Pages 81559553 and 81723400 deleted with `af confluence delete`, which trashes them, then purged (`DELETE /wiki/api/v2/pages/{id}?purge=true`, 204; both now 404). The rejected create left no issue (AM-17 does not exist).

## 2. Types and pure media helpers

- [x] 2.1 In `atlassian/lib/adf-types.ts`, add types for `mediaSingle` (`layout`, `width?`, `widthType?`), `media` (file and external forms), `mediaGroup`, `mediaInline` and `caption`.
- [x] 2.2 Create `atlassian/lib/adf-media.ts` (design D8) with:
    - `MEDIA_UUID`, plus `isMediaReference(url)` and `mediaIdOf(url)` (case-insensitive UUID, kept as written);
    - `displayAlt(attrs, mediaNames?)`;
    - `collectMedia(doc)`, which returns each media node with its parent `mediaSingle` and `caption`, in document order.
- [x] 2.3 In the same module, add `reconcileMedia(next, current, mediaNames?)` per design D4 and the shared spec, returning `{ doc, removed, unknown }`:
    - index by `attrs.id`, the first occurrence winning;
    - copy the attributes allowed for the target type;
    - the alt rule; the parent `mediaSingle` attributes; the caption rule;
    - the `occurrenceKey` rule from 1.4;
    - never mutate the inputs, and never throw.

    Put a comment above the function recording the spike date and the behaviour it verified.
    - Done, with three additions recorded in design D4's implementation notes: the stored marks are copied too (also added to the shared spec); a disallowed `type` and a missing `layout` or `collection` fall back to the target's own; and any non-empty string `id` is indexed. The module also exports `isMediaUrl`, `mediaUrl` and `captionText`, which the renderer shares for image titles.
- [x] 2.4 Add `atlassian/lib/adf-media.test.ts`, covering every scenario of the shared requirement **Media attributes restored from the current document**:
    - an untouched image; a moved image; changed alt text;
    - an alt equal to the looked-up name staying absent;
    - an unchanged caption keeping its marks, and a removed caption;
    - removed media listed with names, and `media <uuid>` when the name is unknown;
    - an unknown UUID keeping its defaults;
    - an image moved inline (`media` to `mediaInline`) copying only the allowed attributes;
    - a malformed `current` that does not throw;
    - inputs left unmodified.
    - Done (27 tests). The `media <uuid>` wording belongs to `formatRemovedMediaWarning` and is tested with it (6.1).

## 3. Rendering media (`atlassian/lib/adf-to-markdown.ts`)

- [x] 3.1 Render design D2's table:
    - `mediaSingle` as its own block (the caption's plain text as the title), and `mediaGroup` as one line per file;
    - `mediaInline` in place, through the inline chunk model (an image chunk for images, link chunks for files, so that the existing escaping applies);
    - external media as `![alt](<url>)`;
    - a malformed node as its alt text or nothing.

    Handle these inside list items, blockquotes and table cells. Remove `mediaInline`'s dependence on `attrs.text`.
    - Done. A usable `id` is a UUID (design D2's implementation notes). A `mediaSingle` without a `media` child renders its children as before.
- [x] 3.2 Thread `options.mediaNames` from `adfToText(adf, options?)` in `atlassian/lib/adf.ts` down to `displayAlt`. Calling `adfToText` with one argument keeps working.
- [x] 3.3 Escape names and captions so that they read back unchanged (`a]b.png`, `[`, backslashes, and `"` in titles). Confirm that a text node containing the characters `![x](media:<uuid>)` still renders escaped, and reads back as text.
    - It did **not**: the existing rules leave `[` alone in running text. A targeted rule now escapes text that looks like a reference (design D2's implementation notes), and so does a `(` after a `]` in a name, because marked takes the backslashes off brackets in link text before lexing it.
- [x] 3.4 Extend `atlassian/lib/adf-to-markdown.test.ts`: one case per D2 row, the scenarios of the shared requirement **ADF media nodes in markdown** that concern rendering (the MR-4 shape, a caption, file cards, `mediaNames`, a bracket in a name), media in a list item, a blockquote and a table cell, and no throw on media without `attrs`.

## 4. Parsing `media:` references (`atlassian/lib/markdown-to-adf.ts`)

- [x] 4.1 In `mapLink`, add a branch for `media:` URLs (design D3):
    - a valid reference among other inline content becomes `mediaInline` with the defaults settled in 1.4;
    - an invalid reference becomes plain text with no `link` mark;
    - a reference inside another link's text becomes text with the outer link.
- [x] 4.2 In `mapBlock`, promote paragraphs:
    - a paragraph that is exactly one valid media image becomes `mediaSingle` (alt from the alt text, `caption` from the title);
    - a paragraph of only valid media links, separated by whitespace or breaks, becomes `mediaGroup`.

    Apply this in the document, blockquote and list-item contexts and in table cells (a cell holding exactly one media image). In a heading, references stay text.
    - Done. ADF allows no `mediaGroup` in a list item, so link references there stay inline files. The shared spec now says "(images only)" for list items; see design D3's implementation notes, which also cover task items.
- [x] 4.3 Extend `atlassian/lib/markdown-to-adf.test.ts`: one case per D3 row, the parsing scenarios of the shared requirement (an embedded image, file cards, an inline file, an invalid reference, a heading, an `https` image unchanged), and schema validation of every output with `test/helpers/adf.ts`.
- [x] 4.4 Confirm that `atlassian/lib/adf.corpus.test.ts` and the existing converter tests pass unchanged: markdown without `media:` URLs converts exactly as before.
    - Confirmed: the corpus, `adf.test.ts` and the earlier converter tests pass with no test or fixture changed. All 763 tests in `atlassian/lib` pass.

## 5. Media round-trip suite

- [x] 5.1 Add `test/fixtures/adf-media.json`, with fixed UUIDs and the shapes observed on 2026-11-11 (design Context):
    - a Jira description: bold `Screenshot:` plus `mediaSingle { layout: "align-start", width: 694, widthType: "pixel" }` > `media { type: "file", id, collection: "", alt, width: 1916, height: 155 }`;
    - a Confluence body: a captioned image with `collection: "contentId-12345"` and no `alt`, plus its `mediaNames`;
    - a `mediaGroup` with two files;
    - a sentence with a `mediaInline`;
    - an external image.
    - Done. Each case also carries its expected markdown. The inline file uses the shape Confluence stored in the spike: no `type`, a `contentId-…` collection, and no `alt` (named through `mediaNames`).
- [x] 5.2 Add `atlassian/lib/adf.media-roundtrip.test.ts`:
    - for each fixture, `reconcileMedia(textToAdf(adfToText(doc, { mediaNames })), doc, mediaNames).doc` deep-equals `doc` in every media node and its container, with nothing removed;
    - the external image reads back as a link;
    - every intermediate document validates against the vendored schema.
    - Done (21 tests). The four non-external cases compare the whole reconciled document with the original, not only the media nodes.

## 6. Facade and Jira

- [x] 6.1 In `atlassian/lib/adf.ts`, export `textToAdfKeepingMedia(markdown, current, mediaNames?)`, returning `{ doc, removed, unknown }`. Add `formatRemovedMediaWarning(removed, { kind: 'issue' | 'page', key })` (design D7) to `adf-media.ts`.
    - Done. Images and files are counted separately ("1 embedded image and 2 embedded files"), an unknown name reads `media <uuid>`, a page is named `page <id>`, and the result is `''` when nothing was removed. The shared spec's facade scenarios are in `adf.media-roundtrip.test.ts`, and the warning tests are in `adf-media.test.ts`.
- [x] 6.2 In `jira/lib/client.ts`:
    - add `getIssueDescription(key)` (`GET /issue/{key}?fields=description`, returning the ADF or `null`) and `getComment(key, id)`;
    - let `updateIssue`'s `description` and `updateComment`'s text also accept an `AdfDocument`, which is sent as given. A string still goes through `textToAdf`, and `''` still clears the description.
- [x] 6.3 In `commands/jira.ts`, `update`, when `--description` or `--description-file` is given (design D5):
    1. after the argument checks and `readProse`, call `getIssueDescription(key)`;
    2. build the document with `textToAdfKeepingMedia`;
    3. call `updateIssue` with the ADF;
    4. after success, print `formatRemovedMediaWarning` on standard error when anything was removed.

    `--description ""` sends `null` as today, and still reports the removed media. No GET happens when the description is not being changed.
    - Done. The GET comes after `readProse` and after the custom fields are resolved, right before the PUT, which keeps the window between them short.
- [x] 6.4 In `commands/jira.ts`, `comment edit`, make the same change with `getComment(key, id)` and `updateComment`. The `--internal` / `--public` service-desk path is unchanged.
- [x] 6.5 Extend `commands/jira.test.ts` and `jira/lib/client.test.ts`:
    - add `getIssueDescription` and `getComment` to the client mock factory;
    - cover:
        - the GET comes before the PUT, and the PUT carries the restored attributes;
        - the removed-media warning goes to standard error, with exit 0;
        - with `--json`, standard output holds only JSON;
        - `update --summary` makes no GET;
        - `comment` add makes no GET and sends a `mediaInline`;
        - a failed GET writes nothing;
        - `updateIssue` and `updateComment` pass ADF through unchanged, and strings behave as before.
    - Done: 10 command tests and 7 client tests. Four existing command tests now expect the ADF document that the command builds rather than the markdown. The comment-add test runs the real `addComment` against a recording `fetch` and sees exactly one POST.

## 7. Confluence

- [x] 7.1 In `confluence/lib/client.ts`, have `updatePage` reconcile against the page it already fetches:
    - parse `current.body.atlas_doc_format.value`;
    - build `mediaNames` from `getAllAttachments(pageId)` (`fileId` to `title`) only when a current media node lacks `alt`;
    - send `textToAdfKeepingMedia(bodyMarkdown, currentDoc, mediaNames).doc`;
    - return the removed media alongside the page, for the warning.
    - Done. `updatePage` now returns `{ page, removed }`. The client also exports `parseAdfBody` and `mediaNamesOf`, and `adf-media.ts` exports `hasMediaWithoutAlt`: a media node with a UUID `id` and no `alt` (or an empty one).
- [x] 7.2 For `af confluence get`, when the body has a media node without `alt`, fetch `getAllAttachments(pageId)` once and pass `mediaNames` through the formatter helper to `adfToText`. `af confluence comments` makes no lookup.
    - Done. With `--json`, `get` prints the page as before and makes no lookup, since the names would not be used.
- [x] 7.3 In `commands/confluence.ts`, print `formatRemovedMediaWarning(…, { kind: 'page', key: pageId })` on standard error after a successful `update` that removed media.
- [x] 7.4 Extend `commands/confluence.test.ts` and `confluence/lib/client.test.ts`:
    - add any new client function to the mock factory;
    - cover:
        - a lookup only when `alt` is missing, made at most once;
        - none when every node has `alt`;
        - the image with no `alt` keeps no `alt` and its `contentId-…` collection after `update`;
        - the warning on standard error;
        - `create` and `comment` send default attributes with no extra request.
    - Done: 7 command tests and 7 client tests. The `updatePage` mock in `beforeEach` now resolves to `{ page, removed: [] }`.

## 8. Documentation

- [x] 8.1 Add an `EMBEDDED IMAGES` note to `af jira --help` and `af confluence --help` (design D11):
    - `![name](media:…)` and `[name](media:…)` lines are embedded attachments;
    - keep a line to keep the embed, move it to move the embed, delete it to remove the embed (the attachment stays);
    - download with `af jira download <KEY> --name '<name>'` or `af confluence download <page-id> --name '<name>'`.
    - Done, with a help test for each. The Jira note also says that a `media:` line works only on the issue that holds the attachment (spike, Open Question 2).
- [x] 8.2 Update the Atlassian section of `CLAUDE.md`:
    - the `adf.ts` / `adf-to-markdown.ts` / `markdown-to-adf.ts` bullets gain the media rules and the `mediaNames` option;
    - add `textToAdfKeepingMedia` and the read-before-write updates of `update --description…`, `comment edit` and `confluence update`;
    - note that media nodes are no longer skipped (superseding D11 of the archived converter change).
    - Done: the project tree (`adf-media.ts`), the converter bullets, a Jira "Embedded images" bullet and a Confluence "Embedded images" paragraph, including the spike's finding that Jira accepts only the issue's own attachments.
- [x] 8.3 Add any new words flagged by `bun run spell:check` to `.cspell.json`.
    - Done: `recognise`, from Jira's error message as quoted in the design and tasks. The other flags were fixed in the text instead: US spelling in a comment, a plainer test name, and a rephrased task note.

## 9. Verification

- [x] 9.1 Run `bun run format:check`, `bun run lint`, `bun run spell:check` and `bun run test`. Use `bun run test` (Vitest), never `bun test`. All must pass.
    - Passed on 2026-11-12: format:check clean, lint clean (exit 0, no output), spell:check 0 issues in 601 files, and `bun run test` 58 files with 2079 passed and 5 skipped (before this change: 56 files, 1947 passed and 5 skipped). `tsc --noEmit` still reports the 29 errors in 6 files that predate this change, and none in a touched file.
- [x] 9.2 Smoke test against the live site:
    - read-only: `af jira get MR-4` ends its description with `![image-20251217-080021.png](media:0ab844aa-b95b-46bd-9d6c-a7d69ac7b901)`; `af confluence get <page-id>` names its images.
    - Writes go only to new scratch content in the sandbox project and space from 1.1:
        - create a scratch issue, then attach and embed a PNG as in 1.1 and 1.2;
        - run `af jira get` > edit one sentence > `af jira update --description-file`, and confirm the stored `mediaSingle` and `media` attributes are unchanged;
        - remove the line and confirm the warning, and that the attachment is still listed;
        - repeat on a scratch Confluence page;
        - delete the scratch content.

    Record the results in this task.
    - Results (2026-11-12, working-tree CLI `bun main.ts`):
        - MR-4 (read-only): the description ends with `![image-20251217-080021.png](media:0ab844aa-b95b-46bd-9d6c-a7d69ac7b901)`.
        - Jira, scratch issue AM-19 (attachment 10149, UUID `86d63825-6ee1-445c-a01a-622460ab2a0c`), embedded by a raw PUT with `align-start` / `width: 694` / `widthType: "pixel"`, `alt`, `width: 1916`, `height: 155` and a caption with a bold mark:
            - `af jira get` showed `![spike-red.png](media:86d63825-… "Login flow")`.
            - `af jira update --description-file` with one sentence reworded: exit 0 and no warning. The stored `mediaSingle`, `media` and caption are identical to before; only the sentence changed.
            - With the line removed: exit 0, and stderr says `Warning: this update removed 1 embedded image from AM-19: spike-red.png. The attachment is still on the issue.` `af jira attachments AM-19` still lists 10149.
            - Extra: `af jira comment AM-19 --body "See ![…](media:…) …"` stored a default `mediaInline`, and the comment listing shows `[spike-red.png](media:…)`. A `comment edit` that kept it gave no warning. One that dropped it, with `--json`, printed JSON on stdout and an "embedded file" warning on stderr.
        - Confluence, scratch page 81592351 (attachment att81657879, `fileId` `9c295964-c1c1-46d2-9187-040191cbedb4`), embedded by a raw PUT in Confluence's shape: no `alt`, `contentId-81592351`, `align-end` / `width: 40` / pixel, and a bold caption:
            - `af confluence get` named it from the attachments: `![spike-blue.png](media:9c295964-… "Login flow")`.
            - `af confluence update --body-file` with one sentence reworded: the first attempt got HTTP 500 (`Internal Server Error`) and wrote nothing (the page stayed at version 2). The identical retry succeeded (exit 0, no warning), and the stored media is identical to before: no `alt` was added, and the collection, sizes, layout and caption are kept.
            - With the line removed: exit 0, and stderr says `Warning: this update removed 1 embedded image from page 81592351: spike-blue.png. The attachment is still on the page.` The attachment is still listed.
        - Deleted: AM-19 (`af jira delete`), and page 81592351 (`af confluence delete`, then purged; it now answers 404). Nothing named "af spike" is left in AM or in the personal space.
