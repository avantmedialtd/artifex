# sonarqube-command Specification

## Purpose
TBD - created by archiving change add-sonarqube-support. Update Purpose after archive.
## Requirements
### Requirement: SonarQube command routing

The CLI SHALL route `af sonar <subcommand>` to the SonarQube command handler.

#### Scenario: Sonar command with subcommand

- **GIVEN** the user runs `af sonar pr 42`
- **WHEN** the router processes the command
- **THEN** it delegates to the sonar command handler
- **AND** passes `pr` as the subcommand with `42` as the argument

#### Scenario: Sonar command without subcommand shows help

- **GIVEN** the user runs `af sonar`
- **WHEN** the router processes the command
- **THEN** it displays sonar-specific help information
- **AND** lists `pr`, `gate`, and `prs` as available subcommands

#### Scenario: Help command lists sonar

- **GIVEN** the user runs `af help`
- **WHEN** the help output is rendered
- **THEN** it includes an entry for `sonar` describing it as the SonarQube command group

### Requirement: SonarQube authentication

The CLI SHALL authenticate to SonarQube using a bearer token read from the `SONAR_TOKEN` environment variable.

#### Scenario: Missing token

- **GIVEN** `SONAR_TOKEN` is not set in the environment
- **WHEN** the user runs any `af sonar` subcommand that calls the API
- **THEN** the CLI prints an error indicating `SONAR_TOKEN` is required
- **AND** exits with a non-zero status code
- **AND** does not make any HTTP request to SonarQube

#### Scenario: Token rejected by SonarQube

- **GIVEN** `SONAR_TOKEN` is set but invalid
- **WHEN** the SonarQube API responds with 401 or 403
- **THEN** the CLI prints an error indicating the token was rejected
- **AND** suggests checking `SONAR_TOKEN`
- **AND** exits with a non-zero status code

#### Scenario: Token sent as bearer header

- **GIVEN** `SONAR_TOKEN` is set to `abc123`
- **WHEN** the CLI makes a request to SonarQube
- **THEN** the request includes an `Authorization: Bearer abc123` header

### Requirement: Base URL resolution

The CLI SHALL resolve the SonarQube base URL by checking `SONAR_BASE_URL`, then `sonar.host.url` in `sonar-project.properties`.

#### Scenario: SONAR_BASE_URL environment variable

- **GIVEN** `SONAR_BASE_URL` is set to `https://sonar.example.com`
- **WHEN** the CLI makes a SonarQube request
- **THEN** requests are sent to `https://sonar.example.com`

#### Scenario: Fall back to properties file

- **GIVEN** `SONAR_BASE_URL` is not set
- **AND** `sonar-project.properties` in the current directory contains `sonar.host.url=https://sonar.example.com`
- **WHEN** the CLI makes a SonarQube request
- **THEN** requests are sent to `https://sonar.example.com`

#### Scenario: Trailing slash normalized

- **GIVEN** the resolved base URL ends with a trailing slash
- **WHEN** the CLI constructs an API URL
- **THEN** the trailing slash is removed before appending `/api/...`

#### Scenario: No base URL configured

- **GIVEN** `SONAR_BASE_URL` is not set
- **AND** no `sonar-project.properties` file is found
- **WHEN** the user runs an `af sonar` subcommand that calls the API
- **THEN** the CLI prints an error indicating the base URL could not be resolved
- **AND** exits with a non-zero status code

### Requirement: Project key resolution

The CLI SHALL resolve the SonarQube project key by checking the `--project` flag, then `sonar.projectKey` in `sonar-project.properties`.

#### Scenario: Explicit --project flag

- **GIVEN** the user runs `af sonar pr 42 --project myorg_artifex`
- **WHEN** the CLI makes Sonar API requests
- **THEN** `myorg_artifex` is used as the project key regardless of any properties file

#### Scenario: Fall back to properties file

- **GIVEN** the user runs `af sonar pr 42` with no `--project` flag
- **AND** `sonar-project.properties` contains `sonar.projectKey=myorg_artifex`
- **WHEN** the CLI makes Sonar API requests
- **THEN** `myorg_artifex` is used as the project key

#### Scenario: Properties file searched in parent directories

- **GIVEN** the user runs `af sonar pr 42` from `<repo>/src/auth/`
- **AND** `sonar-project.properties` exists at `<repo>/`
- **WHEN** the CLI resolves the project key
- **THEN** it finds the properties file by walking up from cwd
- **AND** reads `sonar.projectKey` from it

#### Scenario: No project key configured

- **GIVEN** no `--project` flag is provided
- **AND** no `sonar-project.properties` file is found
- **WHEN** the user runs an `af sonar` subcommand that requires a project key
- **THEN** the CLI prints an error indicating the project key could not be resolved
- **AND** the error message names the directories searched
- **AND** the CLI exits with a non-zero status code

#### Scenario: Properties file ignores comments and blank lines

- **GIVEN** `sonar-project.properties` contains `# comment`, blank lines, and `sonar.projectKey=K`
- **WHEN** the CLI parses the file
- **THEN** comments and blank lines are ignored
- **AND** `sonar.projectKey` resolves to `K`

### Requirement: Pull request quality gate inspection

The CLI SHALL display the SonarQube quality gate status for a Bitbucket pull request.

#### Scenario: Explicit PR id

- **GIVEN** valid Sonar configuration
- **WHEN** the user runs `af sonar pr 42`
- **THEN** the CLI fetches `qualitygates/project_status`, `issues/search`, and `measures/component` for PR 42
- **AND** displays a combined view containing the gate status, failed conditions, top new issues, and key measures
- **AND** displays a link to the SonarQube web UI for the PR

#### Scenario: Failed gate output

- **GIVEN** the PR's quality gate is `ERROR`
- **WHEN** the combined view is rendered
- **THEN** the headline indicates the gate failed
- **AND** failed conditions are listed with their actual and threshold values
- **AND** the exit code is non-zero to signal failure for scripting

#### Scenario: Passing gate output

- **GIVEN** the PR's quality gate is `OK`
- **WHEN** the combined view is rendered
- **THEN** the headline indicates the gate passed
- **AND** the exit code is zero

#### Scenario: Top issues truncation

- **GIVEN** the PR has more than 4 new issues
- **WHEN** the combined view is rendered without `--issues`
- **THEN** at most 4 issues are shown, ordered by severity descending
- **AND** a hint indicates how many more issues exist and how to see them

#### Scenario: Full issues list

- **GIVEN** the user runs `af sonar pr 42 --issues`
- **WHEN** the issues are rendered
- **THEN** all new issues on the PR are listed (paginated through the API as needed)
- **AND** each issue includes type, severity, file, line, and message

#### Scenario: PR not analyzed by SonarQube

- **GIVEN** SonarQube has no record of pull request 42 for the project
- **WHEN** the user runs `af sonar pr 42`
- **THEN** the CLI prints an error indicating the PR has not been analyzed
- **AND** the error names the project key and PR id queried
- **AND** the CLI exits with a non-zero status code

### Requirement: Pull request auto-detection from current branch

The CLI SHALL auto-detect the pull request id from the current git branch's open Bitbucket pull request when no id is provided.

#### Scenario: Single open PR for branch

- **GIVEN** the current branch has exactly one open Bitbucket pull request
- **WHEN** the user runs `af sonar pr` with no id
- **THEN** the CLI resolves the PR id via the Bitbucket client
- **AND** uses it for the SonarQube lookup

#### Scenario: No open PR for branch

- **GIVEN** the current branch has no open Bitbucket pull requests
- **WHEN** the user runs `af sonar pr` with no id
- **THEN** the CLI prints an error indicating no open PR was found for the branch
- **AND** the error suggests passing the PR id explicitly
- **AND** the CLI exits with a non-zero status code

#### Scenario: Multiple open PRs for branch

- **GIVEN** the current branch has more than one open Bitbucket pull request
- **WHEN** the user runs `af sonar pr` with no id
- **THEN** the CLI prints an error indicating the PR is ambiguous
- **AND** lists each candidate PR's id and title
- **AND** the CLI exits with a non-zero status code

#### Scenario: Bitbucket credentials missing during auto-detect

- **GIVEN** `BITBUCKET_API_TOKEN` (and its legacy alias) are not set
- **WHEN** the user runs `af sonar pr` with no id
- **THEN** the CLI prints an error indicating auto-detect requires Bitbucket credentials
- **AND** suggests either configuring Bitbucket env vars or passing the PR id explicitly
- **AND** the CLI exits with a non-zero status code

#### Scenario: Explicit id skips Bitbucket lookup

- **GIVEN** `BITBUCKET_API_TOKEN` is not set
- **WHEN** the user runs `af sonar pr 42`
- **THEN** the CLI proceeds without calling Bitbucket
- **AND** queries SonarQube directly for PR 42

### Requirement: Main branch quality gate inspection

The CLI SHALL display the SonarQube quality gate status for the project's main branch.

#### Scenario: Get main branch gate

- **GIVEN** valid Sonar configuration
- **WHEN** the user runs `af sonar gate`
- **THEN** the CLI fetches `qualitygates/project_status` for the project without a `pullRequest` parameter
- **AND** displays the gate status and failed conditions
- **AND** the exit code is zero when the gate passes and non-zero when it fails

### Requirement: Pull request listing

The CLI SHALL list pull requests known to SonarQube for the current project.

#### Scenario: List PRs

- **GIVEN** valid Sonar configuration
- **WHEN** the user runs `af sonar prs`
- **THEN** the CLI fetches `project_pull_requests/list` for the project
- **AND** displays each PR's id, title, branch, gate status, and analysis date

### Requirement: JSON output mode

The CLI SHALL support a `--json` flag on every `af sonar` subcommand to emit raw API responses.

#### Scenario: JSON output for pr subcommand

- **GIVEN** the user runs `af sonar pr 42 --json`
- **WHEN** the API responses are received
- **THEN** stdout contains a single JSON object aggregating the gate, issues, and measures responses
- **AND** no human-readable formatting is emitted on stdout

#### Scenario: JSON output for gate subcommand

- **GIVEN** the user runs `af sonar gate --json`
- **WHEN** the API response is received
- **THEN** stdout contains the raw `qualitygates/project_status` JSON response

#### Scenario: JSON output for prs subcommand

- **GIVEN** the user runs `af sonar prs --json`
- **WHEN** the API response is received
- **THEN** stdout contains the raw `project_pull_requests/list` JSON response

### Requirement: Package publishing allowlist

The `package.json` `files` array SHALL include `sonar/**/*.ts` so the sonar implementation is shipped in the published npm tarball.

#### Scenario: Published tarball includes sonar directory

- **GIVEN** the package is published
- **WHEN** `npm pack --dry-run` is run
- **THEN** the listed files include the `sonar/lib/` TypeScript sources

#### Scenario: sonar command works from installed package

- **GIVEN** the package is installed globally from npm
- **WHEN** the user runs `af sonar pr 42`
- **THEN** the command loads without `Cannot find module` errors

