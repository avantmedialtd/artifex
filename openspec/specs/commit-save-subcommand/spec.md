# commit-save-subcommand Specification

## Purpose
TBD - created by archiving change add-commit-save-subcommand. Update Purpose after archive.
## Requirements
### Requirement: Commit save subcommand exists

The `commit` command MUST support a `save` subcommand that stages all changes and commits with the provided message.

#### Scenario: Developer runs commit save with message only

- **GIVEN** there are staged or unstaged changes in the repository
- **WHEN** the developer executes `af commit save "Fix bug in parser"`
- **THEN** the CLI runs `git add .` to stage all changes
- **AND** creates a commit with message "Fix bug in parser"
- **AND** displays success message "Committed: Fix bug in parser"
- **AND** exits with status code 0

#### Scenario: Developer runs commit save with message and single trailer

- **GIVEN** there are staged or unstaged changes in the repository
- **WHEN** the developer executes `af commit save "Fix bug in parser" Issue=PROJ-123`
- **THEN** the CLI runs `git add .` to stage all changes
- **AND** creates a commit with message "Fix bug in parser" and trailer "Issue: PROJ-123"
- **AND** displays success message "Committed: Fix bug in parser"
- **AND** exits with status code 0

#### Scenario: Developer runs commit save with multiple trailers

- **GIVEN** there are staged or unstaged changes in the repository
- **WHEN** the developer executes `af commit save "Add feature" Issue=PROJ-456 Reviewed-by=alice`
- **THEN** the CLI runs `git add .` to stage all changes
- **AND** creates a commit with message "Add feature"
- **AND** appends trailer "Issue: PROJ-456"
- **AND** appends trailer "Reviewed-by: alice"
- **AND** displays success message "Committed: Add feature"
- **AND** exits with status code 0

### Requirement: Trailer syntax uses Key=Value format

The `commit save` subcommand MUST parse trailer arguments in `Key=Value` format and convert them to git `--trailer "Key: Value"` flags.

#### Scenario: Simple Key=Value trailer

- **GIVEN** the developer provides argument `Issue=PROJ-123`
- **WHEN** the commit is created
- **THEN** the CLI passes `--trailer "Issue: PROJ-123"` to git

#### Scenario: Trailer value with spaces (quoted)

- **GIVEN** the developer provides argument `Co-authored-by="Bob Smith <bob@example.com>"`
- **WHEN** the commit is created
- **THEN** the CLI passes `--trailer "Co-authored-by: Bob Smith <bob@example.com>"` to git

### Requirement: Message argument is required

The `commit save` subcommand MUST require a message argument.

#### Scenario: Developer runs commit save without message

- **GIVEN** the developer executes `af commit save` without a message
- **WHEN** the command is processed
- **THEN** the CLI displays an error message: "Error: commit save requires a message"
- **AND** displays usage hint: "Usage: af commit save \"<message>\" [Key=Value...]"
- **AND** exits with status code 1

### Requirement: Git commit failure handling

The commit save command MUST handle git failures gracefully.

#### Scenario: Nothing to commit

- **GIVEN** there are no staged or unstaged changes in the repository
- **WHEN** the developer executes `af commit save "Some message"`
- **THEN** the CLI displays a message: "Nothing to commit"
- **AND** exits with status code 0

#### Scenario: Git commit fails

- **GIVEN** there are changes to commit
- **AND** the git commit command fails (e.g., due to git configuration issues)
- **WHEN** the commit fails
- **THEN** the CLI displays an error message: "Error: Failed to create commit"
- **AND** exits with status code 1

### Requirement: Help content for commit save

The help system MUST include documentation for the commit save subcommand.

#### Scenario: Developer views general help

- **GIVEN** the commit save subcommand exists
- **WHEN** the developer executes `af help`
- **THEN** the help output includes a line for:
  - "commit save <msg> [K=V]  Commit all changes with message and trailers"

#### Scenario: Developer views commit command help

- **GIVEN** the commit save subcommand exists
- **WHEN** the developer executes `af help commit`
- **THEN** the help output includes examples showing trailer usage:
  - `af commit save "Fix bug" Issue=PROJ-123`
  - `af commit save "Add feature" Issue=PROJ-456 Reviewed-by=alice`

