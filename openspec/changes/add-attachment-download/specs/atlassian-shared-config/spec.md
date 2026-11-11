## ADDED Requirements

### Requirement: Attachment download to local files

The shared download helper (`atlassian/lib/download.ts`) SHALL implement the download behaviour that `af jira download` and `af confluence download` have in common.

**Destination.**

- Without `--out`, each run SHALL create a new, empty folder in the OS temporary directory, with a name starting with the prefix the command defines.
- `--out <dir>` SHALL write into that directory, creating it and any missing parents.
- No folder SHALL be created when no file will be written, either because nothing is selected or because `--out -` is given.

**Local filenames.** Each attachment's name from the metadata SHALL be turned into a single path component:

- normalized to Unicode NFC;
- with `/`, `\`, NUL and the other control characters (U+0001–U+001F and U+007F) replaced by `_`;
- replaced by `attachment-<id>` when the result is empty, `.` or `..`;
- when longer than 255 UTF-8 bytes, shortened in its stem while keeping its extension (the text after the last `.`, when at most 16 bytes), without splitting a character.

**Collisions.** Attachments SHALL be named in ascending order of their numeric ID: the Jira ID, or the digits of a Confluence `att…` ID. Two names that are equal after NFC normalization and lowercasing collide. The first attachment SHALL keep its name, and each later one SHALL get `-<id>` inserted before its extension. If that name is also taken, a counter SHALL follow (`-<id>-2`, and so on).

**Existing files with `--out <dir>`.** Before any download, every final path SHALL be inspected without following symlinks:

- nothing there: the file is downloaded;
- a regular file whose size equals the attachment's size: the file is skipped, and its status is `skipped`;
- any other entry (a regular file of a different size, a directory, a symlink, or any other file type): a conflict.

When there is any conflict, the command SHALL print every conflicting path, download nothing, and exit with code 1. With `--force`, every selected file SHALL be written, replacing a file or symlink at its path. A directory at a path SHALL still be an error. `--force` without `--out <dir>` SHALL be an argument error.

**Writing.**

- Each file SHALL be streamed into a temporary file in the destination directory. The temporary file is created exclusively (it fails when its path exists) and named `.af-<random>.part`.
- When the number of bytes written differs from the attachment's size in the metadata, the temporary file SHALL be deleted and the file SHALL fail with an error giving both numbers.
- Otherwise the temporary file SHALL be renamed onto the final name.
- On any error, the temporary file SHALL be deleted.

**Requests and credentials.**

- Every download URL SHALL start with the configured base URL.
- Redirects SHALL be followed by the helper, at most 5 hops, each `Location` resolved against the current URL.
- The `Authorization` header SHALL be sent only to URLs whose origin equals the base URL's origin. A hop to another origin SHALL be sent without it.
- More than 5 hops SHALL fail the file with an error.
- A non-2xx response SHALL fail the file with the API's error message, parsed as other Atlassian errors are, or with `HTTP <status>: <statusText>` when the body is not a recognized error.

**Phases and concurrency.**

- All metadata SHALL be fetched before any download. A metadata failure SHALL exit with code 1 before any folder is created or any file is downloaded.
- At most 4 metadata requests and at most 4 downloads SHALL be in flight at once.
- A failed download SHALL NOT stop the other downloads. When any file fails, the exit code SHALL be 1, and the files already written SHALL remain.

**Filtering.** `--name <pattern>` SHALL keep only the attachments whose whole metadata name matches the pattern, ignoring case. `*` matches any run of characters, `?` matches exactly one character, and every other character matches itself. When the selection is not empty but no attachment matches, the command SHALL print the available filenames and exit with code 1.

**Output.**

- The command SHALL print the folder's absolute path, then one line per file with its ID, its size and its absolute path, the path last. A skipped file SHALL be marked `(already present)`, and a failed file SHALL be reported on standard error with its reason.
- With `--json`, the command SHALL print `{ "directory", "files" }`. Each entry of `files` SHALL have `id`, `filename` (the metadata name), `path` (the absolute local path), `size`, `mimeType` and `status`, which is `downloaded`, `skipped` or `failed`. A failed entry SHALL also carry `error`.
- Notices and warnings SHALL go to standard error.

**Standard output.**

- `--out -` SHALL write the bytes of exactly one attachment to standard output, and nothing else.
- When the selection, after filtering, holds more or fewer than one attachment, the command SHALL say how many were selected and exit with code 1 before downloading.
- When the number of bytes written differs from the attachment's size in the metadata, the command SHALL report both numbers on standard error and exit with code 1.
- `--json` together with `--out -` SHALL be an argument error.

#### Scenario: Each run gets a fresh folder

- **GIVEN** `af jira download MR-10` has already run once
- **WHEN** the user runs `af jira download MR-10` again
- **THEN** a second, different folder is created in the OS temporary directory
- **AND** both runs print absolute paths inside their own folder

#### Scenario: A name with path separators stays inside the folder

- **GIVEN** an attachment's metadata name is `../../.zshrc`
- **WHEN** it is downloaded
- **THEN** it is written as `.._.._.zshrc` inside the destination folder
- **AND** nothing is written outside the destination folder

#### Scenario: A dot name falls back to the attachment ID

- **GIVEN** attachment 10050's metadata name is `..`
- **WHEN** it is downloaded
- **THEN** it is written as `attachment-10050`

#### Scenario: A long name keeps its extension

- **GIVEN** an attachment's metadata name is 300 ASCII characters ending in `.png`
- **WHEN** it is downloaded
- **THEN** its local name is at most 255 bytes long and ends in `.png`

#### Scenario: Names that differ only in case get the ID

- **GIVEN** attachment 10046 is named `Shot.png` and attachment 10047 is named `shot.png`
- **WHEN** both are downloaded in one run
- **THEN** they are written as `Shot.png` and `shot-10047.png`

#### Scenario: An existing file of the same size is skipped

- **GIVEN** `./shots/mobile-modules.png` exists with the attachment's size
- **WHEN** the user runs `af jira download MR-10 --out ./shots`
- **THEN** `mobile-modules.png` is not downloaded and is marked `(already present)`
- **AND** the other attachment is downloaded

#### Scenario: A conflicting file stops the run before any download

- **GIVEN** `./shots/mobile-modules.png` exists with a different size
- **WHEN** the user runs `af jira download MR-10 --out ./shots`
- **THEN** an error listing `./shots/mobile-modules.png` as a conflict is printed
- **AND** no attachment is downloaded
- **AND** the exit code is 1

#### Scenario: --force replaces existing files

- **GIVEN** `./shots/mobile-modules.png` exists with a different size
- **WHEN** the user runs `af jira download MR-10 --out ./shots --force`
- **THEN** `./shots/mobile-modules.png` holds the attachment's bytes

#### Scenario: A planted symlink is not written through

- **GIVEN** `./shots/mobile-modules.png` is a symlink to another file
- **WHEN** the user runs `af jira download MR-10 --out ./shots --force`
- **THEN** `./shots/mobile-modules.png` is a regular file holding the attachment's bytes
- **AND** the file the symlink pointed to is unchanged

#### Scenario: --force without --out is rejected

- **WHEN** the user runs `af jira download MR-10 --force`
- **THEN** an error saying `--force` needs `--out <dir>` is printed
- **AND** the exit code is 1
- **AND** no request is sent

#### Scenario: A short download leaves no file behind

- **GIVEN** the metadata says an attachment has 26,904 bytes and the server sends 1,000
- **WHEN** it is downloaded
- **THEN** an error giving both byte counts is printed
- **AND** neither the final file nor a temporary file exists in the destination folder
- **AND** the exit code is 1

#### Scenario: Credentials stay on the configured site

- **GIVEN** the download URL on the configured site answers with a redirect to `https://api.media.atlassian.com/file/…`
- **WHEN** the attachment is downloaded
- **THEN** the request to the configured site carries the `Authorization` header
- **AND** the request to `api.media.atlassian.com` carries no `Authorization` header

#### Scenario: Too many redirects

- **GIVEN** a download URL redirects 6 times
- **WHEN** the attachment is downloaded
- **THEN** that file fails with an error about too many redirects

#### Scenario: At most four downloads run at once

- **GIVEN** issue MR-1 has 12 attachments
- **WHEN** the user runs `af jira download MR-1`
- **THEN** no more than 4 downloads are in flight at any moment
- **AND** all 12 files are downloaded

#### Scenario: One failed download does not stop the others

- **GIVEN** issue MR-2 has two attachments and the content request for one of them fails
- **WHEN** the user runs `af jira download MR-2 --json`
- **THEN** the other attachment is downloaded
- **AND** the JSON lists one entry with status `downloaded` and one with status `failed` and an `error`
- **AND** the exit code is 1

#### Scenario: A pattern that matches nothing

- **GIVEN** issue MR-10 has attachments `mobile-modules.png` and `mobile-property-settings.png`
- **WHEN** the user runs `af jira download MR-10 --name '*.pdf'`
- **THEN** an error naming the pattern and listing `mobile-modules.png` and `mobile-property-settings.png` is printed
- **AND** no folder is created
- **AND** the exit code is 1

#### Scenario: Stream one attachment to standard output

- **WHEN** the user runs `af jira download 10046 --out -`
- **THEN** standard output receives exactly the attachment's bytes
- **AND** no folder is created

#### Scenario: Standard output needs exactly one attachment

- **GIVEN** issue MR-10 has two attachments
- **WHEN** the user runs `af jira download MR-10 --out -`
- **THEN** an error saying 2 attachments were selected and `--out -` takes one is printed
- **AND** nothing is downloaded
- **AND** the exit code is 1

#### Scenario: --json with standard output is rejected

- **WHEN** the user runs `af jira download 10046 --out - --json`
- **THEN** an argument error is printed
- **AND** the exit code is 1
- **AND** no request is sent

#### Scenario: JSON output

- **WHEN** the user runs `af jira download MR-10 --json`
- **THEN** standard output is a JSON object with the absolute `directory` and a `files` array
- **AND** each entry has `id`, `filename`, `path`, `size`, `mimeType` and `status`
