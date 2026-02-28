## MODIFIED Requirements

### Requirement: Help content accuracy

Help information MUST accurately reflect the current command behavior and options.

#### Scenario: Help includes all available commands

- **GIVEN** the CLI has commands including jenkins
- **WHEN** the developer executes `af help`
- **THEN** all available commands are listed in the help output including jenkins
- **AND** no obsolete or removed commands are shown

#### Scenario: Help shows correct usage syntax

- **GIVEN** the developer views help for a command
- **WHEN** the help text shows usage syntax
- **THEN** the syntax matches the actual command interface
- **AND** required arguments are clearly marked
- **AND** optional arguments are clearly indicated

#### Scenario: Jenkins-specific help

- **GIVEN** the user runs `af help jenkins`
- **THEN** detailed jenkins command help is displayed
- **AND** all subcommands and options are documented
