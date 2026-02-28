## MODIFIED Requirements

### Requirement: Help documentation

The CLI SHALL include jira commands in help output.

#### Scenario: General help includes jira

- **GIVEN** the user runs `af help`
- **THEN** jira commands are listed in the available commands

#### Scenario: Jira-specific help

- **GIVEN** the user runs `af help jira`
- **THEN** detailed jira command help is displayed
- **AND** all subcommands and options are documented
- **AND** the `--estimate` and `--remaining` options are documented for create and update commands
- **AND** the version management commands are documented (versions, version, version-create, version-update, version-delete)
- **AND** the `--fix-version` and `--affected-version` options are documented for create and update commands
- **AND** the `link`, `unlink`, and `remote-link` subcommands are documented
- **AND** the `--type` option is documented for the link command
- **AND** the `--from` option is documented for the unlink command
- **AND** the `--url`, `--title`, and `--remove` options are documented for the remote-link command
