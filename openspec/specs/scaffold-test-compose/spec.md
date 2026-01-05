# scaffold-test-compose Specification

## Purpose
TBD - created by archiving change add-scaffold-test-compose-command. Update Purpose after archive.
## Requirements
### Requirement: Generate test compose file

The `af scaffold test-compose` command SHALL generate a `docker-compose.test.yml` file in the current directory.

#### Scenario: Generate file in empty directory

Given the current directory does not contain `docker-compose.test.yml`
When the user runs `af scaffold test-compose`
Then a `docker-compose.test.yml` file is created
And the file contains a `migrate-seed` service definition
And the file contains `hosting-server` override with migration dependency
And the file contains `e2e` override with migration dependency
And the command exits with code 0

#### Scenario: File already exists

Given the current directory contains `docker-compose.test.yml`
When the user runs `af scaffold test-compose`
Then an error message is displayed: "docker-compose.test.yml already exists"
And the existing file is not modified
And the command exits with code 1

### Requirement: Valid compose file structure

The generated file MUST be a valid Docker Compose overlay file.

#### Scenario: File structure validation

Given the user runs `af scaffold test-compose`
When the file is generated
Then the file starts with a comment describing its purpose
And the file includes usage instructions in comments
And the `migrate-seed` service uses the `testing` profile
And the `migrate-seed` service depends on `db` with `service_healthy` condition
And the `migrate-seed` service has `restart: "no"` configuration
And the file can be used with `docker compose -f docker-compose.yml -f docker-compose.test.yml`

### Requirement: Scaffold command structure

The scaffold command SHALL serve as a parent for file generation subcommands.

#### Scenario: No subcommand provided

Given the user runs `af scaffold` without arguments
When the command is executed
Then an error message is displayed: "scaffold command requires a subcommand"
And a hint is shown: "Run 'af help scaffold' for more information."
And the command exits with code 1

#### Scenario: Unknown subcommand

Given the user runs `af scaffold unknown`
When the command is executed
Then an error message is displayed: "Unknown scaffold subcommand: unknown"
And a hint is shown: "Run 'af help scaffold' for available subcommands."
And the command exits with code 1

### Requirement: Help documentation

The scaffold command SHALL be documented in the help system.

#### Scenario: Scaffold help content

Given the user runs `af help scaffold`
When the help is displayed
Then the output includes description of the scaffold command
And the output lists `test-compose` as an available subcommand
And the subcommand description explains its purpose

