## ADDED Requirements

### Requirement: Bitbucket body and description from stdin

`--body-file` on `pr comment add`, `pr comment update`, `pr task add` and `pr task update`, and `--description-file` on `pr create` and `pr update`, SHALL accept `-` to read the text from standard input. The text SHALL be sent as typed; Bitbucket renders it as markdown.

The existing rule that an inline flag and its file twin cannot be combined SHALL also apply when the file twin is `-`, and SHALL be checked before standard input is read. A file that does not exist SHALL produce the error `File not found: <path>`.

An inline comment or task body that is empty or only whitespace SHALL be an error, with no request sent. An inline `--description ""` SHALL keep its current meaning: `pr create` sends an empty description, and `pr update` clears the description.

#### Scenario: Comment from a quoted heredoc

- **WHEN** the user runs `af bb pr comment add 42 --body-file - <<'AF_BODY'`, followed by the lines `## Summary`, an empty line, `- First point` and `AF_BODY`
- **THEN** a POST is made with `content.raw` equal to the heredoc body, including its final newline

#### Scenario: Pull request description from stdin

- **WHEN** the user runs `af bb pr create --title "Fix bug" --description-file -` with text on standard input
- **THEN** the request body's description field is the text read from standard input

#### Scenario: Inline body together with stdin is rejected

- **GIVEN** standard input is a pipe carrying text
- **WHEN** the user runs `af bb pr comment add 42 --body "x" --body-file -`
- **THEN** the error `Cannot use both --body and --body-file` is printed
- **AND** standard input is not read
- **AND** the exit code is 1

#### Scenario: Missing body file

- **WHEN** the user runs `af bb pr comment add 42 --body-file missing.md`
- **THEN** the error `File not found: missing.md` is printed
- **AND** the exit code is 1

#### Scenario: Empty stdin creates no task

- **WHEN** the user runs `af bb pr task add 42 --body-file - </dev/null`
- **THEN** an error naming `--body-file` and standard input is printed
- **AND** the exit code is 1
- **AND** no task is created

#### Scenario: Empty inline comment body is rejected

- **WHEN** the user runs `af bb pr comment add 42 --body ""`
- **THEN** an error naming `--body` and saying that it is empty is printed
- **AND** the exit code is 1
- **AND** no request is sent

#### Scenario: Empty inline description clears it on update

- **WHEN** the user runs `af bb pr update 42 --description ""`
- **THEN** a PUT request is made whose description field is the empty string

### Requirement: Strict option checking on Bitbucket pull request prose commands

These subcommands SHALL reject any option that the subcommand and action do not accept, and SHALL reject more positional arguments than they take:

- `pr create` and `pr update`;
- `pr comment`, with every action;
- `pr task`, with every action.

The exported `parseArgs` SHALL perform this check, so either error exits with code 1 before any file or standard input is read and before any request is sent. `--json`, `--workspace` and `--repo` SHALL be accepted by all of these subcommands, and `pr create` SHALL accept the branch aliases `--source`, `--src`, `--destination` and `--dest`. Other `af bitbucket` subcommands are not covered by this requirement.

The unknown-option error SHALL name the option and the command, and SHALL list the options the command accepts. When the intent is clear, it SHALL also suggest the intended option:

- a prose flag name that another command uses maps to this command's prose flag or its `-file` twin;
- a near-miss spelling maps to the closest accepted option.

The extra-argument error SHALL name the first unexpected argument. It SHALL say that text containing spaces or apostrophes must be quoted, or passed through the `-file` flag.

#### Scenario: Another command's comment flag is rejected with a hint

- **WHEN** the user runs `af bb pr comment add 42 --add "LGTM"`
- **THEN** an error naming `--add` and suggesting `--body` is printed
- **AND** the exit code is 1
- **AND** no request is sent

#### Scenario: A body flag on pull request creation suggests the description flag

- **WHEN** the user runs `af bb pr create --title "Fix" --body "Details"`
- **THEN** an error naming `--body` and suggesting `--description` is printed
- **AND** the exit code is 1
- **AND** no pull request is created

#### Scenario: An unquoted multi-word body is rejected

- **WHEN** the user runs `af bb pr comment add 42 --body Looks good`
- **THEN** an error naming `good` as an unexpected argument and mentioning quoting is printed
- **AND** the exit code is 1
- **AND** no request is sent

#### Scenario: An option the action does not accept

- **WHEN** the user runs `af bb pr update 42 --draft`
- **THEN** an error naming `--draft` and `pr update` is printed
- **AND** the exit code is 1

#### Scenario: Global options and branch aliases are accepted

- **WHEN** the user runs `af bb pr create --title T --src feature/x --dest main --workspace ws --repo r --json`
- **THEN** no option error is reported
- **AND** the pull request is created from `feature/x` into `main` in `ws/r`

### Requirement: Bitbucket options accept `--name=value`

The `af bitbucket` argument parser SHALL accept `--<name>=<value>` as equivalent to `--<name> <value>` for every option that takes a value, on every subcommand, including the branch aliases and repeatable options. It SHALL split the argument at the first `=`, so the value MAY be empty and MAY itself contain `=`. A boolean option written with `=` SHALL be rejected with an error saying that the option takes no value.

#### Scenario: Inline body with an equals sign

- **WHEN** the user runs `af bb pr comment add 42 --body="LGTM"`
- **THEN** a POST is made with body `{content: {raw: "LGTM"}}`

#### Scenario: Branch alias with an equals sign

- **WHEN** the user runs `af bb pr create --title T --src=feature/x`
- **THEN** the source branch in the request body is `feature/x`

#### Scenario: Repeatable option with an equals sign

- **WHEN** the user runs `af bb pipeline trigger --branch main --var=FOO=bar`
- **THEN** the pipeline variables contain `FOO` with the value `bar`

#### Scenario: Boolean option with a value is rejected

- **WHEN** the user runs `af bb pr create --title T --draft=true`
- **THEN** an error saying that `--draft` takes no value is printed
- **AND** the exit code is 1

### Requirement: Bitbucket help documents multi-line input

`af bitbucket --help`, `af bitbucket -h`, `af bb --help`, `af help bitbucket`, `af help bb`, `af bitbucket help` and `af bitbucket` with no arguments SHALL all print the same full Bitbucket reference. The reference SHALL:

- document that `--body-file` and `--description-file` take a path, or `-` for standard input;
- say that the text is sent as typed and that Bitbucket renders it as markdown;
- explain that `\n` inside a quoted argument is not a newline;
- show a multi-line example that feeds a quoted heredoc to `--body-file -`, printed so that each line starts in the first column.

#### Scenario: The alias help flag prints the full reference

- **WHEN** the user runs `af bb --help`
- **THEN** the output is identical to the output of `af help bitbucket`
- **AND** it lists the `pr comment` and `pr task` subcommands

#### Scenario: Help for the alias prints the full reference

- **WHEN** the user runs `af help bb`
- **THEN** the output is identical to the output of `af help bitbucket`

#### Scenario: Multi-line example can be copied as printed

- **WHEN** the user runs `af help bitbucket`
- **THEN** the output contains these consecutive lines, each starting in the first column: `af bb pr comment add 42 --body-file - <<'AF_BODY'`, `## Summary`, an empty line, `- First point` and `AF_BODY`
