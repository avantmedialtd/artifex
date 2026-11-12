## Context

**Current state.**

- `adfToText` has no rule for `mediaSingle`, `mediaGroup` or `media`. Blocks it does not know fall through to "render the children", and `media` has none, so the block renders empty and is skipped. `mediaInline` is listed as an inline atom, but its text comes from `attrs.text`, which media nodes do not have, so it renders as nothing.
- This was deliberate. Decision D11 of the archived `replace-markdown-adf-converter` reads: "blocks that render empty (for example media) are skipped".
- `textToAdf` maps every markdown image to its alt text with a `link` mark to the image URL (D9 of the same change).
- Update paths convert markdown inside the client and send the result as the whole document:
    - `updateIssue` sets `fields.description = textToAdf(description)`;
    - `updateComment` sends `{ body: textToAdf(text) }`;
    - Confluence `updatePage` already fetches the current page with `body-format=atlas_doc_format`, for its version number, then sends `textToAdf(bodyMarkdown)`.
- `adfToText` is called from the Jira formatters (description, issue comments, the comment listing and worklog previews) and from one Confluence formatter helper.

**Observed media shapes** (live site, 2026-11-11, read-only):

| | Jira (MR-4 description) | Confluence (page body) |
|---|---|---|
| Container | `mediaSingle` `{ width: 694, widthType: "pixel", layout: "align-start" }` | `mediaSingle` (attributes not recorded) |
| `media.attrs.type` | `file` | `file` |
| `media.attrs.id` | a Media Services UUID (`0ab844aa-b95b-46bd-9d6c-a7d69ac7b901`) | a UUID equal to an attachment's `fileId` |
| `media.attrs.collection` | `""` | `contentId-<page-id>` |
| `media.attrs.alt` | the filename (`image-20251217-080021.png`) | absent |
| Other attributes | `width: 1916`, `height: 155` | not recorded |
| Link to the attachment | No field (`properties: {}`). Indirect: `alt` equals the filename, `renderedFields` HTML has `<img src="…/attachment/content/10046" alt="…">`, and the 303 `Location` of `GET /attachment/content/{id}` is `…/file/<uuid>/binary`, whose UUID equals the media node's `id` (verified 2026-11-12) | `fileId` on the v2 attachment, an exact match |

**ADF schema** (vendored `test/fixtures/adf-schema-full.json`):

- `mediaSingle` requires `layout` (one of `wide`, `full-width`, `center`, `wrap-right`, `wrap-left`, `align-end`, `align-start`), or `layout` with `width` and `widthType`. It may carry a `caption`.
- `media` requires `type`, `id` and `collection` for files, or `type` and `url` for external media. It may carry `alt`, `width`, `height`, `occurrenceKey` and `localId`.
- `mediaInline` requires `id` and `collection`.
- `mediaGroup` holds `media` nodes.

**Constraint.** Markdown that contains no `media:` reference must convert exactly as it does today. The round-trip guarantee and the regression corpus are not reopened.

## Goals / Non-Goals

**Goals:**

- Show every embedded image and file where it sits, in a form an agent can read and keep.
- Make get → edit → update preserve media exactly when the agent leaves a media line alone, and keep its presentation when the line is moved.
- Never lose an embed silently: report media that an update removes.
- One mechanism for Jira and Confluence.

**Non-Goals:**

- Embedding a newly uploaded file. The content redirect makes it possible; it is a follow-up.
- External images from markdown (`![x](https://…)` stays a link).
- Display names for Jira media without `alt`.
- Media inside headings, which ADF forbids.
- Guarding against edits made between the GET and the PUT, beyond keeping that window short.

## Decisions

### D1. Identity in the markdown: `media:<uuid>`

A media node is written with the URL `media:<uuid>`:

- an image (`mediaSingle`) uses image syntax: `![alt](media:<uuid>)`, or `![alt](media:<uuid> "caption")`;
- a file card (`media` in a `mediaGroup`) or an inline file (`mediaInline`) uses link syntax: `[name](media:<uuid>)`.

The alt text or name is `displayAlt(attrs, mediaNames)`: `attrs.alt` when it is not empty, else the name that `mediaNames` gives for the UUID, else empty.

A reference is valid only when the UUID matches `^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$` (case-insensitive) and is kept as written. Both products use Media Services UUIDs: Jira's `media.attrs.id`, and Confluence's `fileId`, which also names the file in its media URL.

| Alternative | Why not |
|---|---|
| `![alt](attachment:10046)`, using the attachment ID | Jira's REST API cannot map an attachment ID to a media UUID, so the node could not be rebuilt |
| Every attribute in the URL (`media:<uuid>?layout=…&width=…`) | Rejected by the user (2026-11-11). Agents would carry noise, and a wrong edit corrupts presentation |
| An HTML comment carrying the node | The converter keeps raw HTML as literal text (its D8), so the comment would become visible text |
| The UUID alone, with presentation reset on every update | Rejected by the user. Sized images would be re-centered after every agent edit |

### D2. Rendering (`adfToText`)

| ADF | Markdown |
|---|---|
| `mediaSingle` > `media` (file) | Its own block: `![alt](media:<uuid>)`, with `"caption"` as the title when the `caption` has text. In a list item or blockquote, it is a block of that container; in a table cell, it is inline in the cell |
| `mediaGroup` | One block: each `media` as `[name](media:<uuid>)`, one per line (lines joined by single newlines, which read back as hard breaks) |
| `mediaInline` | `[name](media:<uuid>)` in place, inside the sentence |
| `media` with `type: external` | `![alt](<url>)`. It reads back as a link (D9), a documented limit |
| `media` without a usable `id` or `url` | Its alt text as plain text, or nothing |

- Alt text, names and captions are escaped as link text is today (D12 of the converter, plus `[`, `]` and `\`), so a name such as `a]b.png` survives.
- Titles escape `"` and `\`.
- Text that merely looks like a reference (the characters `![x](media:…)` typed into a paragraph) is escaped by the existing rules and reads back as text, never as media.
- `adfToText(adf, { mediaNames })` takes an optional `ReadonlyMap<string, string>` from UUID to name, used only by `displayAlt`. Without it, a node with no `alt` renders `![](media:<uuid>)`.
- `adfToText` still never throws.

Implementation notes (2026-11-12):

- A "usable `id`" is a UUID, since only a UUID reads back as a reference. A node whose `id` is anything else renders as its alt text, or nothing, as the two existing tests with `id: "x"` and `id: "m"` expect.
- The existing rules did **not** escape a look-alike: running text keeps its `[` (a documented limit for links). So the renderer now gives a backslash to each `[`, and to the `<` of `<media:`, in a paragraph whose text holds `](media:` or `<media:`. Such text then reads back as text. A backslash that already precedes a `[` is lost on the way back, as before any punctuation in running text.
- In link text, marked takes the backslashes off `\[` and `\]` before it lexes the text. So a name such as `Look! ![x](y)` would turn back into an image. A `(` right after a `]` in a name gets a backslash too.
- A name is escaped minimally: `\`, `` ` ``, `*`, `~`, `[`, `]` and `<`; a `&` before `#`; a `_` unless it sits between two letters or digits; and that `(`. `image-20251217-080021.png` and `my_file.png` are written as they are.
- The title is `captionText(caption)` from `adf-media.ts`, which turns hard breaks and line endings into spaces. `reconcileMedia` compares captions with the same function.

### D3. Parsing (`textToAdf`)

In each case, the alt text or name, when not empty, becomes `attrs.alt`.

| Markdown | ADF |
|---|---|
| A paragraph whose only content, apart from whitespace, is one image with a valid `media:` URL | `mediaSingle { layout: "center" }` > `media { type: "file", id, collection: "" }`, plus a `caption` holding the title text when there is a title |
| A paragraph whose only content is one or more links with valid `media:` URLs, separated by whitespace or line breaks | `mediaGroup` > one `media { type: "file", id, collection: "" }` per link |
| A link or image with a valid `media:` URL among other inline content | `mediaInline { type: "file", id, collection: "" }` |
| A `media:` URL that is not a valid reference | The alt text or link text (or the URL when that is empty) as plain text, with no `link` mark |
| A valid reference where ADF allows no media (a heading, or inside link text, where the outer link wins) | The alt text or link text, as text, with the marks it would otherwise have |

- Media blocks are allowed where the converter's context rules already allow media: the document, a blockquote, a list item. In a table cell, a cell whose only content is a media image becomes a `mediaSingle` in that cell.
- `https` images and links are untouched (D9).
- The defaults are the smallest attributes the schema accepts. Whether Jira and Confluence accept them for a node that is new to the document is a spike question (D9 below). If one rejects them, the defaults are adjusted, or that product's create paths fall back to text.

One round-trip limit follows from these rules: a paragraph that holds only a `mediaInline` and no text reads back as a one-item `mediaGroup`.

Implementation notes (2026-11-12):

- **No `mediaGroup` in a list item.** The vendored schema's `listItem` allows `mediaSingle` but not `mediaGroup` (blockquotes, table cells and the document allow both). So in a list item, a paragraph of only link references stays a paragraph of `mediaInline` nodes. The shared spec says that media blocks are produced in list items "(images only)".
- **Table cells: images only, as specified.** A cell of only link references reads back as inline files, so file cards in a cell come back inline: a round-trip limit.
- **Task items.** The paragraph after a tight task item's checkbox gets the ballot box, so it is never promoted; its references are inline.
- **Names.** The alt text is the plain text of the image description, as CommonMark defines it: emphasis and code delimiters are dropped, and a line ending is a space. The text of an autolink (`<media:…>`) is its URL, so it gives no name.
- Headings map their inline content with media off, in every context. A `#` line inside a list item, which becomes a paragraph, keeps its references as text too.

### D4. Reconciliation by UUID (`reconcileMedia`)

`reconcileMedia(next, current, mediaNames?)` is a pure function. It returns `{ doc, removed, unknown }`:

1. **Index** every media node in `current` (`media` inside `mediaSingle` or `mediaGroup`, and `mediaInline`) by `attrs.id`. The first occurrence wins. A `media` in a `mediaSingle` keeps its parent's attributes and `caption`.
2. **Match** every media node in `next` with an indexed UUID:
    - its attributes are replaced by the indexed node's attributes, limited to the keys the target node type allows (`media` versus `mediaInline`, for an image the agent moved inline);
    - **alt rule:** when the markdown's alt text equals `displayAlt(indexed attrs, mediaNames)`, the indexed `alt` is kept exactly, including when it is absent. Otherwise `alt` becomes the markdown's alt text, or is removed when that is empty;
    - when both nodes sit in a `mediaSingle`, the parent's attributes (`layout`, `width`, `widthType`, …) are replaced by the indexed parent's;
    - **caption rule:** when the markdown's caption text equals the indexed caption's plain text, the indexed `caption` node is reused, which keeps its marks. When the markdown has no caption, there is none. Otherwise the caption is plain text.
    - **`occurrenceKey`** (spike, 2026-11-12): copied like every other attribute, to every occurrence of the UUID. Both products accept duplicates that share it, and both drop it on store (Open Question 4).
3. **Unknown:** UUIDs in `next` that are not in `current` keep D3's defaults and are returned in `unknown`.
4. **Removed:** UUIDs in `current` that are not in `next` are returned in `removed`, each with its display name.

Malformed nodes in either document are left as they are, and the function never throws.

Implementation notes (2026-11-12):

- "The keys the target node type allows" are the ADF schema's: `type`, `id`, `collection`, `alt`, `width`, `height`, `occurrenceKey` and `localId` on `media`, those and `data` on `mediaInline`, and `layout`, `width`, `widthType` and `localId` on `mediaSingle`. Anything else is not copied, such as the `__fileName` that Confluence sometimes returns. A `type` that the target does not allow is replaced by the target's own: a `mediaInline` of type `image` that becomes an image gets `file`. A missing `layout` or `collection` is filled in from the target's defaults.
- The matched node also gets the stored node's marks (`border`, `link`, `annotation`, …), and an image's `mediaSingle` gets the stored `mediaSingle`'s `link` mark. Markdown cannot carry marks on media either. Without this, an image with a border or a link would lose it on every edit, so it could not come back "byte-for-byte". The shared spec lists this under the attribute bullet.
- Any `id` that is a non-empty string is indexed, a UUID or not. A node whose `id` is not a UUID cannot be written as a reference (D2), so an update always removes it, and the warning reports it as removed.

**Why the server copy, and not the markdown?** An untouched image comes back byte-for-byte without the agent seeing layout or size. A moved image keeps its presentation. Matching by UUID is exact, while matching by position or filename is not (two attachments can share a filename).

**The alt rule for Confluence.** Without it, every Confluence image would gain an `alt` equal to its filename on its first edit, because `get` shows the looked-up name and the markdown sends it back.

### D5. Jira: read before write

- `af jira update <key>` with `--description` or `--description-file`:
    1. after the argument checks and after the input is read, the CLI sends `GET /rest/api/3/issue/{key}?fields=description`;
    2. it builds the document with `textToAdfKeepingMedia(markdown, current)`;
    3. it sends the PUT.
- The GET happens on every description update, not only when the new text has `media:` references. That way an update whose text has none, the most dangerous case, still reports what it removes. This follows `af bb pr update`, which reads before it writes so that it never drops reviewers.
- `--description ""` clears the description, as today, and every current media node is reported as removed.
- `af jira comment edit <key> <id>` does the same with `GET /rest/api/3/issue/{key}/comment/{id}`. A JSM comment (`--internal` / `--public`) is sent as typed text, not ADF, and is unaffected.
- Creating an issue, adding a comment, and transition and worklog comments have no current document. They send D3's defaults with no extra request.
- A failed GET is reported like any request error, and nothing is written.
- **Client shape.** `updateIssue` and `updateComment` accept a ready ADF document as well as markdown, and send what they are given. The command builds the document, as in `af bb pr update`, where the client PUTs exactly the body it receives.

### D6. Confluence: reconcile against the page already fetched; names by `fileId`

- `updatePage` parses `current.body.atlas_doc_format.value` and reconciles against it, at no extra request for the document.
- **Names by `fileId`.** When the current body, or the page being displayed, has a media node with no `alt`, the CLI fetches the page's attachments (`getAllAttachments(pageId)` from `add-attachment-download`) and builds `mediaNames` from `fileId` to `title`.
    - This happens at most once per command, and never when every media node has `alt`.
    - `af confluence get` uses `mediaNames` for display, and `af confluence update` uses it for the alt rule.
- **Comments.** `af confluence comments` renders without a lookup, because which container owns a comment's media is unverified.
- **New content.** `af confluence create` and `af confluence comment` use D3's defaults. For a node that is new to a page, the collection stays `""` unless the spike shows Confluence needs `contentId-<page-id>`. In that case the update path sets it for unknown UUIDs. The spike (2026-11-12) showed it does not: Confluence resolves `""` to the owning page's collection itself (Open Question 1), so the collection stays `""`.

### D7. The removed-media warning

When `removed` is not empty, the CLI prints this on standard error, after a successful write:

```
Warning: this update removed 1 embedded image from MR-4: image-20251217-080021.png. The attachment is still on the issue.
```

- The wording is "file" for a `mediaGroup` or `mediaInline` entry, and "page" for Confluence.
- A name that is not known reads `media <uuid>`.
- The exit code stays 0. Removing an embed is a legitimate edit, and the attachment itself is untouched (the spike confirmed this on 2026-11-12 for both products, Open Question 3).
- `--json` output is unchanged, and the warning still goes to standard error.

### D8. Module layout

- **`atlassian/lib/adf-media.ts` (new).** Pure functions, testable without the converters' internals:
    - `isMediaReference(url)` and `mediaIdOf(url)`;
    - `displayAlt`;
    - `collectMedia(doc)`;
    - `reconcileMedia`.
- **`atlassian/lib/adf.ts`.**
    - `adfToText(adf, options?)`, with an optional, backward-compatible second parameter;
    - `textToAdfKeepingMedia(markdown, current, mediaNames?)`, which returns `{ doc, removed, unknown }` and is used by every update path.
- **`atlassian/lib/adf-types.ts`.** Types for `mediaSingle`, `media`, `mediaGroup`, `mediaInline` and `caption`.
- Rendering and parsing rules live in `adf-to-markdown.ts` and `markdown-to-adf.ts`, next to the rules they extend:
    - an image chunk, or link chunks for files, in the renderer's inline model;
    - paragraph promotion in `mapBlock`;
    - the `media:` branch in `mapLink`.

### D9. A spike on scratch content runs before the reconciliation code

The spike sends raw PUTs with the same credentials af uses, and writes only to scratch content.

**Jira**, with a scratch issue in a sandbox project: attach a PNG with `af jira attach`, and read its media UUID from the `Location` of `GET /rest/api/3/attachment/content/{id}`, without following the redirect. Step b runs first and embeds that file with D3's defaults. If Jira accepts it, the other steps run on the stored embed. If Jira rejects it, the spike stops and asks for an image pasted through the UI.

| Step | Question | What the answer decides |
|---|---|---|
| a | Re-send the description unchanged: does the image stay? | The baseline: an identical node is accepted |
| b | Replace the node with D3's defaults (`layout: center`, `type: file`, `id`, `collection: ""`): accepted, and does it render? | D3's defaults for Jira |
| c | Remove the node: is the attachment still in `fields.attachment`? | D7's "the attachment is still on the issue" |
| d | Put the same node into a second scratch issue: accepted, and does it render? | Whether an unknown UUID on create or update should warn |
| e | Duplicate the node, `occurrenceKey` included: accepted? | Whether D4 copies `occurrenceKey` to every occurrence or only the first |

**Confluence**, which needs no hand-pasted image: create a page, attach a PNG with `af confluence attach`, take its `fileId`, then run steps a to d with `collection: "contentId-<page-id>"`, and also with `""` for step b.

The answers are recorded in this design's Open Questions, with the date, and in a comment above `reconcileMedia`. The scratch issues and pages are deleted afterwards.

### D10. Tests

- **Unit tests.** Every D2 and D3 row has a test.
- **Escaping.** `a]b.png`, `[`, backslashes and `"` in titles.
- **Invalid references and positions.** Invalid UUIDs, references in headings and inside link text.
- **Media round-trip suite.** Built from the observed shapes (D1 table), with fixed UUIDs:
    - a Jira description with an aligned, sized image and alt;
    - a Confluence body with a captioned image, no alt and a `contentId-…` collection;
    - a `mediaGroup` with two files;
    - a sentence with a `mediaInline`;
    - an external image.

    For each, `reconcileMedia(textToAdf(adfToText(doc, { mediaNames })), doc, mediaNames).doc` must deep-equal `doc` in every media node and its container. The external image is the exception, asserted as a link.
- **Schema validation.** Every converter output is validated against the vendored ADF schema with the existing helpers.
- **Existing suites.** `adf.corpus.test.ts` and the existing converter tests must pass unchanged.

### D11. Documentation

- **Help.** Add an `EMBEDDED IMAGES` note to `af jira --help` and `af confluence --help`:
    - `![name](media:…)` and `[name](media:…)` lines are embedded attachments;
    - keep the line to keep the embed, and move it to move the embed;
    - delete it to remove the embed (the attachment stays);
    - download the file with `af jira download <KEY> --name '<name>'` or `af confluence download <page-id> --name '<name>'`.
- **`CLAUDE.md`.** The converter bullets in the Atlassian section gain the media rules and the read-before-write updates. Decision D11 of the archived converter change is noted as superseded.

## Risks / Trade-offs

- **Jira or Confluence may reject D3's defaults for new nodes.** The spike decides before any parsing code ships. The fallback for a product that rejects them is text for unknown UUIDs on create paths. Updates are unaffected, because known UUIDs get the server's own attributes. Answered on 2026-11-12: both accept them, so there is no fallback (Open Question 1).
- **A reference copied to a different issue may not render.** The spike (D9 d) says whether it does. If not, a warning for unknown UUIDs can be added without changing the syntax. Answered on 2026-11-12: Jira rejects the whole write with a 400 and writes nothing, while Confluence renders the copy. No warning was added (Open Question 2).
- **One more GET on every description update and comment edit.** It is cheap, it follows the `af bb pr update` precedent, and it is what makes the removed-media warning possible.
- **Edits made between the GET and the PUT are overwritten.** That was already true of these commands (they replace the whole document), and the window is milliseconds.
- **Media now appears in outputs that never showed it** (`get`, comment listings, worklog previews). That is intended. Worklog previews may show a truncated `![…](media:…` reference, which is acceptable for a 40-character preview.
- **Agents may garble a reference.** An invalid reference degrades to text, never to a broken node. Reconciliation matches only exact UUIDs, and the removed-media warning shows what was lost.
- **Copying `occurrenceKey` to a duplicated image** might confuse the media service. The spike (D9 e) decides whether only the first occurrence keeps it. Answered on 2026-11-12: both products accept duplicates with the same key and drop `occurrenceKey` on store, so it is copied to every occurrence (Open Question 4).
- **A paragraph holding only an inline file reads back as a one-item file group.** A documented limit. It is rare in practice, because inline files sit inside sentences.

## Migration Plan

- No data migration.
- Outputs gain `media:` references.
- Updates gain a GET and a warning.
- Rollback is a revert. Text written by agents while this change was active contains `media:` lines, which an older af would convert to links (D9), so a revert should be followed by a release note.

## Open Questions

Answered by the spike (D9) on 2026-11-12, on scratch issues AM-16 and AM-18 (project AM) and scratch pages 81559553 and 81723400 (personal space `~5fcf7df29b5eed0076bf1e64`), all deleted afterwards. The files were synthetic 16×16 PNGs: Jira attachment 10148 (media UUID `ef68423c-1ee8-41f5-a978-f5069b2492cd`, read from the content redirect) and Confluence attachment att81592321 (`fileId` `21a63bef-8b38-4aac-99f9-a394dac6e584`). The step-by-step record is in tasks 1.2 and 1.3.

1. **Defaults for a UUID new to the document: accepted by both.**
    - Jira stores `mediaSingle { layout: "center" }` > `media { type: "file", id, collection: "" }` exactly as sent, and renders it. The default `mediaInline` and `mediaGroup` are accepted and render too.
    - Confluence accepts `collection: ""` and `contentId-<page-id>` alike. It rewrites `""` to `contentId-<page-id>`, adds pixel sizes (`media.width` and `height`, `mediaSingle.width` with `widthType: "pixel"`), and stores a `mediaInline` without `type`.
    - **Decision:** D3's defaults stand for both products, with no fallback, and D6's collection for new nodes stays `""`.
2. **A reference copied elsewhere: Jira rejects it, Confluence renders it.**
    - Jira accepts media only from the issue's own attachments. A copied node made the create of a second issue fail with 400 (`We don't recognise the format of a file you added or the data in it`); an update, a new comment, and a UUID that names no file failed with 400 `ATTACHMENT_VALIDATION_ERROR`. Nothing was written in any of these cases. So `af jira create` cannot embed an existing file, because a new issue has no attachments; a copied `media:` line fails loudly.
    - Confluence renders a node copied to another page from the owning page's attachment, both as stored and with `collection: ""`. A UUID that names no file is accepted, but the stored `id` becomes `UNKNOWN_MEDIA_ID`, a broken embed.
    - **Decision:** no warning for UUIDs that are not found (`unknown`). On Jira the write itself fails, or the file is the issue's own and embeds. On Confluence copies work. A garbled but well-formed UUID on Confluence is the one silent case; catching it would cost a lookup per update, which is left for a follow-up. The help text says that a Jira `media:` line works only on the issue that holds the attachment.
3. **Removing an embed keeps the attachment, on both products.** D7's "The attachment is still on the issue" / "on the page" stands.
4. **A duplicated node with the same `occurrenceKey` is accepted by both, and both drop `occurrenceKey` on store** (Jira even on a single node).
    - **Decision (D4):** `occurrenceKey` is copied like every other attribute, to every occurrence.
    - Since neither product keeps it through the REST API, an indexed node rarely has one.

Also observed:

- Jira's `renderedFields` HTML carries `data-media-services-id` and `data-attachment-name` for each embedded file. That would name Jira media without `alt` at no extra request, for the follow-up that the proposal leaves out.
- Right after a save, a Confluence read can return `__fileName`, `__fileSize` and `__fileMimeType` on `media`. These are not in the ADF schema, and later reads usually lack them (except for the `UNKNOWN_MEDIA_ID` node). `reconcileMedia` copies only the attributes the schema allows, and Confluence accepted a resend without them.
