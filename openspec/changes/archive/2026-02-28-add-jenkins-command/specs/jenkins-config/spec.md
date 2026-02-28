## ADDED Requirements

### Requirement: Jenkins environment variables

The CLI SHALL read Jenkins configuration from environment variables.

#### Scenario: All variables set

- **GIVEN** `JENKINS_BASE_URL`, `JENKINS_USER`, and `JENKINS_API_TOKEN` are set in the environment
- **WHEN** a Jenkins command is executed
- **THEN** the CLI authenticates using these credentials

#### Scenario: Base URL trailing slash normalization

- **GIVEN** `JENKINS_BASE_URL` is set to `https://jenkins.example.com/`
- **WHEN** the config is loaded
- **THEN** the trailing slash is stripped

### Requirement: Missing credential handling

The CLI SHALL fail fast with helpful error messages when credentials are missing.

#### Scenario: Missing JENKINS_BASE_URL

- **GIVEN** `JENKINS_BASE_URL` is not set
- **WHEN** the user runs a Jenkins command
- **THEN** an error message indicates `JENKINS_BASE_URL` is required
- **AND** the CLI exits with code 1

#### Scenario: Missing JENKINS_USER

- **GIVEN** `JENKINS_USER` is not set
- **WHEN** the user runs a Jenkins command
- **THEN** an error message indicates `JENKINS_USER` is required
- **AND** the CLI exits with code 1

#### Scenario: Missing JENKINS_API_TOKEN

- **GIVEN** `JENKINS_API_TOKEN` is not set
- **WHEN** the user runs a Jenkins command
- **THEN** an error message indicates `JENKINS_API_TOKEN` is required
- **AND** the CLI exits with code 1

### Requirement: Lazy credential validation

The CLI SHALL validate Jenkins credentials only when Jenkins commands are executed.

#### Scenario: Other commands work without Jenkins config

- **GIVEN** Jenkins environment variables are not set
- **WHEN** the user runs `af help`
- **THEN** the command succeeds without error

### Requirement: Basic authentication

The CLI SHALL authenticate to Jenkins using HTTP Basic auth.

#### Scenario: Auth header construction

- **GIVEN** `JENKINS_USER` is `admin` and `JENKINS_API_TOKEN` is `my-token`
- **WHEN** a request is made to Jenkins
- **THEN** the `Authorization` header is `Basic` followed by base64-encoded `admin:my-token`
