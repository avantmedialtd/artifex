# Show embedded images in markdown and keep them when text is updated

## Why

`adfToText` skips media nodes. The converter's design chose this (decision D11 of `replace-markdown-adf-converter`, "blocks that render empty (for example media) are skipped") because markdown had no way to say "this Atlassian file" and read it back. That has two consequences:

- **Embedded images are invisible.** In `af jira get`, `af confluence get` and the comment listings, an image pasted into a description, comment or page leaves no trace. On MR-4, the description ends with `**Screenshot:**` and then nothing.
- **Editing text deletes them, silently.** `af jira update --description…` sends `textToAdf(markdown)` as the whole description, and `af jira comment edit` and `af confluence update` do the same for comments and pages. An agent that reads an issue, edits the text and writes it back therefore removes every embedded image. The attachment stays on the issue, but the image is gone from the text, and nothing reports it.

The markdown has to carry the image's identity itself. Jira's REST API exposes no field that links an ADF media node to its attachment: the attachment's `properties` was `{}` on 2026-11-11, and the media node's `id` is a Media Services UUID. Confluence attachments do carry that UUID, as `fileId`. With `add-attachment-download` in place, agents can fetch attachments. This change shows embedded images where they sit, and keeps them through an edit.

## What Changes

- **Media renders as markdown.** `adfToText` writes:
    - a `mediaSingle` (an embedded image) as `![alt](media:<uuid>)` on its own line, with a caption as the image title;
    - a `mediaGroup` (file cards) as one `[name](media:<uuid>)` per line;
    - a `mediaInline` (a file chip inside a sentence) as `[name](media:<uuid>)` in place;
    - external media as `![alt](<url>)`.
- **`media:` references read back as media.** `textToAdf` turns each `media:<uuid>` reference back into the matching media node, with default presentation (centered, natural size, empty collection). A `media:` reference without a valid UUID stays plain text.
- **Updates copy presentation back from the server copy.** The user chose this on 2026-11-11, over encoding every attribute in the markdown or resetting images to defaults.
    - `af jira update --description…` and `af jira comment edit` fetch the current document first, one GET each. `af confluence update` uses the page it already fetches.
    - Every media node whose UUID appears in the current document gets that node's attributes back: layout, width, width type, collection, pixel size, occurrence key and alt text. Its caption also comes back when the caption's text is unchanged.
    - An image the agent did not touch is therefore written back exactly as it was. The markdown never carries size or layout.
- **Removed images are reported.** When the current document has a media node that the new text no longer references, a warning on standard error names it and says the attachment itself is unaffected. The update still goes ahead.
- **Confluence images get readable names.** Confluence media nodes carry no `alt`. `af confluence get` and `af confluence update` look the filename up by `fileId` in the page's attachments, only when some media node lacks `alt`. On update, an alt text equal to that looked-up name counts as unchanged, so a page never gains an `alt` attribute it did not have.
- **New content needs no extra request.** `create`, adding a comment, and transition and worklog comments on Jira, and `create` and `comment` on Confluence, build media nodes with default presentation.
- **Spike first.** Before the reconciliation code is written, scratch content on both products shows:
    - which default-attribute media nodes Jira and Confluence accept;
    - whether a `media:` reference copied to a different issue or page still renders;
    - whether removing an embed through the API leaves the attachment in place.
- Help text and the ADF section of `CLAUDE.md` explain `media:` lines: keep the line to keep the image, and download the file with `af jira download` or `af confluence download`.

Explicitly **not** part of this change:

- Uploading a file and embedding it in one step. It is possible, and is left for a follow-up: the 303 `Location` of `GET /rest/api/3/attachment/content/{id}` names the file's media UUID (`…/file/<uuid>/binary`, verified on 2026-11-12 against MR-4's embedded image).
- Turning `![alt](https://…)` into an embedded external image. It stays a link (converter decision D9). External media nodes from the Jira UI are rendered as `![alt](<url>)` and read back as a link, a documented limit.
- Media where ADF does not allow it, such as in a heading. The reference then stays text.
- Display names for Jira media nodes without `alt`. These render as `![](media:<uuid>)`. A lookup would cost one content redirect per attachment, and is left for a follow-up.

**Depends on** `add-attachment-download`, for `getAllAttachments` and `fileId` on `ConfluenceAttachment`, and for the download commands that the help text names.

## Capabilities

### New Capabilities

<!-- None: the converter behaviour belongs to atlassian-shared-config, and the update flows to the product commands. -->

### Modified Capabilities

- `atlassian-shared-config`: new requirements for media nodes in markdown (rendering, parsing, defaults, allowed positions, display names) and for restoring media attributes from the current document (matching by UUID, the alt and caption rules, the removed-media report). The existing **Shared ADF conversion** requirement is unchanged: it never mentions media, and its image rule covers `https` URLs, which keep their behaviour.
- `jira-command`: new requirements for showing embedded media in `get` and the comment listing, and for keeping embedded media on `update --description…` and `comment edit`, including the extra GET and the removed-media warning.
- `confluence-command`: new requirements for showing embedded media in `get` and `comments` (with names looked up by `fileId`), and for keeping embedded media on `update`.

## Impact

- **Code:**
    - `atlassian/lib/adf-to-markdown.ts`: rules for `mediaSingle`, `mediaGroup`, `mediaInline` and external media, plus an optional `mediaNames` map (UUID to name) for nodes without `alt`.
    - `atlassian/lib/markdown-to-adf.ts`: reads `media:` references back into media nodes, in the positions ADF allows.
    - `atlassian/lib/adf-media.ts` (new), pure functions:
        - `reconcileMedia(next, current, mediaNames?)`, which returns the reconciled document and the removed media;
        - `displayAlt`;
        - `collectMedia`.
    - `atlassian/lib/adf.ts`: the `adfToText(adf, { mediaNames })` option, and a `textToAdfKeepingMedia(markdown, current, mediaNames?)` facade used by every update path.
    - `atlassian/lib/adf-types.ts`: media node types.
    - `jira/lib/client.ts`:
        - `getIssueDescription(key)` (`GET /issue/{key}?fields=description`);
        - `getComment(key, id)`;
        - `updateIssue` and `updateComment` accept a ready ADF document as well as markdown.
    - `commands/jira.ts`: the read-before-write description and comment-edit flows, and the warning.
    - `confluence/lib/client.ts`: `updatePage` reconciles against the page it fetches.
    - `confluence/lib/formatters.ts` and `commands/confluence.ts`: names for media without `alt`.
    - Help text; `CLAUDE.md`.
- **APIs:**
    - Jira: one extra `GET /rest/api/3/issue/{key}?fields=description` per `update` that changes the description, and one extra `GET /rest/api/3/issue/{key}/comment/{id}` per `comment edit`.
    - Confluence: one extra `GET /wiki/api/v2/pages/{id}/attachments` (every page of results) per `get` or `update` whose page has a media node without `alt`.
    - No new endpoints beyond those reads.
- **Auth:** no new scopes.
- **Behaviour change:**
    - Media now appears in `get` and comment output, as `media:` references.
    - `update --description…` and `comment edit` make a GET before writing.
    - Text that keeps the `media:` lines keeps its images, and an update that drops one warns.
    - The archived converter decision D11 (media skipped) is superseded.
    - Markdown without `media:` references converts exactly as before, so the existing round-trip guarantee and corpus are unaffected.
- **Tests:**
    - `atlassian/lib/adf-to-markdown.test.ts` and `atlassian/lib/markdown-to-adf.test.ts`: every media form, escaping of alt text and captions, invalid references, and positions where media is not allowed.
    - `atlassian/lib/adf-media.test.ts` (new).
    - A media round-trip suite: documents with media, built from the shapes observed on 2026-11-11 (Jira: `collection: ""`, `alt` set; Confluence: `collection: "contentId-…"`, no `alt`), must come back identical after `adfToText`, then `textToAdf`, then `reconcileMedia` against the original. Every output is validated against the vendored ADF schema.
    - `commands/jira.test.ts` and `commands/confluence.test.ts`: the GET-before-PUT, the warning on standard error, and the unchanged `--json` output.
- **Spike prerequisite:** a sandbox Jira project and Confluence space where scratch content may be created and deleted. The spike uploads its own PNG and reads the media UUID from the content endpoint's redirect, so no image has to be pasted by hand. It writes only to that scratch content.
