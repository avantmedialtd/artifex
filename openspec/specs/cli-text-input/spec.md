# cli-text-input Specification

## Purpose
TBD - created by archiving change add-multiline-body-input. Update Purpose after archive.
## Requirements
### Requirement: Prose input from an inline flag, a file, or stdin

The prose flags are `--body`, `--description` and `--comment` on the commands that the `jira-command`, `confluence-command` and `bitbucket-command` capabilities name. Each prose flag SHALL have a `-file` twin named by appending `-file`: `--body-file`, `--description-file` and `--comment-file`. An alias of a prose flag, such as `--add` for `--body`, SHALL use that flag's twin and SHALL NOT have a twin of its own. Single-line text flags such as `--summary`, `--title`, `--name` and `--message` are not prose flags. The CLI SHALL take a prose value from exactly one of three sources:

- the inline flag's argument, used exactly as the shell delivered it in argv;
- the file whose path is the `-file` twin's value, resolved against the current working directory;
- standard input, when the `-file` twin's value is exactly `-`.

#### Scenario: Inline text is used exactly as received

- **GIVEN** the user types `--body "## Summary\n\n- one"` in bash or zsh, so the argv value holds a backslash followed by `n` wherever `\n` was typed
- **WHEN** `af jira comment PROJ-123` runs with that value
- **THEN** the text handed to the comment is the argv value unchanged
- **AND** no newline is inserted in place of `\n`

#### Scenario: Text from a file path

- **GIVEN** a file `notes.md` in the current directory
- **WHEN** the user runs `af jira comment PROJ-123 --body-file notes.md`
- **THEN** the comment text is the content of `notes.md`

#### Scenario: Text from stdin

- **WHEN** the user runs `af jira comment PROJ-123 --body-file -` with text on standard input
- **THEN** the comment text is the text read from standard input

#### Scenario: A quoted heredoc arrives byte-for-byte

- **GIVEN** a quoted heredoc whose body contains backticks, `$HOME`, an apostrophe and blank lines
- **WHEN** the user runs `af jira comment PROJ-123 --body-file - <<'AF_BODY'`, followed by that body and a line `AF_BODY`, in zsh or in bash 3.2 or later
- **THEN** the comment text equals the heredoc body exactly
- **AND** no command inside the backticks is run and `$HOME` is not expanded

### Requirement: Stdin is read only on an explicit `-`

The CLI SHALL read standard input for prose only when a `-file` flag is given the value `-`. It SHALL NOT read standard input in any other situation, whatever kind of file descriptor standard input is (terminal, pipe, regular file, socket or `/dev/null`). A prose value of `-` given to the inline flag SHALL NOT read standard input.

#### Scenario: Piped data is ignored without `-`

- **GIVEN** standard input is a pipe carrying text
- **WHEN** the user runs `af jira comment PROJ-123 --body "Looks good"`
- **THEN** standard input is not read
- **AND** the comment text is `Looks good`

#### Scenario: A command without input flags never waits on stdin

- **GIVEN** standard input is a socket that never reaches end-of-file
- **WHEN** the user runs `af jira comment PROJ-123`
- **THEN** standard input is not read
- **AND** the issue's comments are listed and the command exits

#### Scenario: A dash on the inline flag is not stdin

- **GIVEN** standard input is a pipe carrying text
- **WHEN** the user runs `af jira comment PROJ-123 --body -`
- **THEN** standard input is not read

### Requirement: Inline and file input are mutually exclusive

The CLI SHALL reject an invocation that gives both a prose flag, or an alias of it, and the flag's `-file` twin, even when one of the values is empty. The error SHALL name both flags as typed, in the form `Cannot use both <inline flag> and <file flag>`, for example `Cannot use both --body and --body-file`. The exit code SHALL be 1, and the CLI SHALL NOT read the file or standard input or send any request.

#### Scenario: Inline text and a file

- **WHEN** the user runs `af jira comment PROJ-123 --body "x" --body-file notes.md`
- **THEN** the error `Cannot use both --body and --body-file` is printed
- **AND** the exit code is 1
- **AND** no request is sent

#### Scenario: Inline text and stdin

- **GIVEN** standard input is a pipe carrying text
- **WHEN** the user runs `af jira update PROJ-123 --description "x" --description-file -`
- **THEN** the error `Cannot use both --description and --description-file` is printed
- **AND** standard input is not read
- **AND** the exit code is 1

#### Scenario: An empty inline value still conflicts

- **WHEN** the user runs `af jira transition PROJ-123 --to Done --comment "" --comment-file notes.md`
- **THEN** the error `Cannot use both --comment and --comment-file` is printed
- **AND** the exit code is 1

### Requirement: Empty file or stdin input is rejected

When prose comes from a file or from standard input, the CLI SHALL reject content that is empty or consists only of whitespace (a byte-order mark counts as whitespace). The error SHALL name the `-file` flag and its source (the path, or standard input), the exit code SHALL be 1, and no request SHALL be sent. The CLI SHALL NOT fall back to any other source. How an empty inline value is treated is defined by each command.

#### Scenario: Empty stdin

- **WHEN** the user runs `af jira comment PROJ-123 --body-file - </dev/null`
- **THEN** an error naming `--body-file` and standard input is printed
- **AND** the exit code is 1
- **AND** no comment is posted and the comments are not listed

#### Scenario: Whitespace-only file

- **GIVEN** `blank.md` contains only spaces and newlines
- **WHEN** the user runs `af jira update PROJ-123 --description-file blank.md`
- **THEN** an error naming `--description-file` and `blank.md` is printed
- **AND** the exit code is 1
- **AND** the issue is not updated

#### Scenario: File containing only a byte-order mark

- **GIVEN** `bom.md` contains only the byte-order mark U+FEFF and a newline
- **WHEN** the user runs `af confluence comment 12345 --body-file bom.md`
- **THEN** an error naming `--body-file` and `bom.md` is printed
- **AND** the exit code is 1

### Requirement: Missing files are reported the same way everywhere

When a `-file` flag names a path that does not exist, every command SHALL fail with the error `File not found: <path>` and exit code 1, before sending any request. A path that exists but cannot be read SHALL produce an error that names the flag, the path and the reason. A `-file` flag given an empty value SHALL be rejected with an error that names the flag and says that it needs a path, or `-` for standard input.

#### Scenario: Missing file on a Jira command

- **WHEN** the user runs `af jira comment PROJ-123 --body-file missing.md`
- **THEN** the error `File not found: missing.md` is printed
- **AND** the exit code is 1

#### Scenario: Missing file on a Bitbucket command

- **WHEN** the user runs `af bb pr create --title T --description-file missing.md`
- **THEN** the error `File not found: missing.md` is printed instead of a raw `ENOENT` message
- **AND** the exit code is 1

#### Scenario: Path is a directory

- **GIVEN** `./docs` is a directory
- **WHEN** the user runs `af confluence update 12345 --body-file ./docs`
- **THEN** an error naming `--body-file`, `./docs` and the reason is printed
- **AND** the exit code is 1

#### Scenario: Empty path

- **WHEN** the user runs `af jira comment PROJ-123 --body-file ""`
- **THEN** an error naming `--body-file` and saying that it needs a path or `-` is printed
- **AND** the exit code is 1
- **AND** no comment is posted and the comments are not listed

### Requirement: Prose text is passed through without interpretation

The CLI SHALL hand prose text to the command unchanged. It SHALL NOT interpret escape sequences such as `\n` or `\t`, SHALL NOT trim leading or trailing whitespace, and SHALL NOT change line endings. The only change SHALL be that one leading byte-order mark (U+FEFF) is removed from text read from a file or from standard input. Inline text SHALL never be changed.

#### Scenario: Escape-like sequences in a file stay literal

- **GIVEN** `notes.md` contains `Logs are in C:\new\notes\app.log`
- **WHEN** the user runs `af bb pr comment add 42 --body-file notes.md`
- **THEN** the comment's `content.raw` contains `C:\new\notes\app.log` unchanged

#### Scenario: Leading byte-order mark is removed from a file

- **GIVEN** `doc.md` starts with the byte-order mark U+FEFF followed by `## Title`
- **WHEN** the user runs `af bb pr comment add 42 --body-file doc.md`
- **THEN** the comment's `content.raw` starts with `## Title`

#### Scenario: Line endings are preserved

- **GIVEN** `notes.md` uses CRLF line endings
- **WHEN** the user runs `af bb pr comment add 42 --body-file notes.md`
- **THEN** the comment's `content.raw` keeps every CRLF line ending

### Requirement: Interactive stdin hint

When a `-file` flag is given `-` and standard input is a terminal, the CLI SHALL print a one-line hint to standard error before reading. The hint SHALL name the flag and say how to end the input (Ctrl-D). The CLI SHALL then read until end-of-file. It SHALL NOT print the hint when standard input is not a terminal, and SHALL never print it to standard output.

#### Scenario: Reading from a terminal

- **GIVEN** standard input is a terminal
- **WHEN** the user runs `af jira comment PROJ-123 --body-file -`
- **THEN** a hint naming `--body-file` and Ctrl-D is printed to standard error
- **AND** the text typed before Ctrl-D becomes the comment text

#### Scenario: Reading from a pipe

- **GIVEN** standard input is a pipe carrying text
- **WHEN** the user runs `af jira comment PROJ-123 --body-file - --json`
- **THEN** no hint is printed
- **AND** standard output contains only the JSON result

### Requirement: Input is resolved after argument checks and before any request

The CLI SHALL check the command line first, including the command's required arguments and the mutual exclusion of inline and file input. Only then SHALL it read prose from a file or standard input, and only after that SHALL it send any request. An error at any of these steps SHALL exit with code 1 and send nothing.

#### Scenario: A missing required option is reported before stdin is read

- **GIVEN** standard input is a terminal
- **WHEN** the user runs `af jira transition PROJ-123 --comment-file -` without `--to`
- **THEN** an error about the missing `--to` option is printed
- **AND** standard input is not read

#### Scenario: An input error sends nothing

- **WHEN** the user runs `af jira update PROJ-123 --summary "New title" --description-file missing.md`
- **THEN** the error `File not found: missing.md` is printed
- **AND** no request is sent, so the summary is not changed either

<!-- cspell:words ENOENT -->

