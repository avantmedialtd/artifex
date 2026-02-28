## ADDED Requirements

### Requirement: Jenkins command routing

The CLI SHALL route `af jenkins <subcommand>` to the Jenkins command handler.

#### Scenario: Jenkins command with subcommand

- **GIVEN** the user runs `af jenkins jobs`
- **WHEN** the router processes the command
- **THEN** it delegates to the jenkins command handler
- **AND** passes `jobs` as the subcommand

#### Scenario: Jenkins command without subcommand shows help

- **GIVEN** the user runs `af jenkins`
- **WHEN** the router processes the command
- **THEN** it displays jenkins-specific help information

### Requirement: Job listing

The CLI SHALL list Jenkins jobs.

#### Scenario: List all jobs

- **GIVEN** valid Jenkins credentials in environment
- **WHEN** the user runs `af jenkins jobs`
- **THEN** top-level jobs are displayed as a table with name, status, and last build info

#### Scenario: List jobs in a folder

- **GIVEN** valid Jenkins credentials in environment
- **WHEN** the user runs `af jenkins jobs my-folder`
- **THEN** jobs within the specified folder are displayed

### Requirement: Job details

The CLI SHALL display details for a specific job.

#### Scenario: Get job details

- **GIVEN** valid Jenkins credentials in environment
- **WHEN** the user runs `af jenkins job my-app`
- **THEN** job metadata and recent builds are displayed
- **AND** the output includes job name, description, buildable status, and a table of recent builds

#### Scenario: Get job details with path separator

- **GIVEN** valid Jenkins credentials in environment
- **WHEN** the user runs `af jenkins job my-folder/my-app`
- **THEN** the path segments are resolved to Jenkins `/job/my-folder/job/my-app/` URL structure

### Requirement: Branch listing for multibranch pipelines

The CLI SHALL list branches and their build statuses for multibranch pipeline jobs.

#### Scenario: List branches

- **GIVEN** valid Jenkins credentials in environment
- **AND** the job is a multibranch pipeline
- **WHEN** the user runs `af jenkins branches my-pipeline`
- **THEN** branches are displayed as a table with branch name, last build number, status, duration, and when

### Requirement: Build information

The CLI SHALL display build details.

#### Scenario: Get latest build info

- **GIVEN** valid Jenkins credentials in environment
- **WHEN** the user runs `af jenkins build my-app/main`
- **THEN** the latest build details are displayed
- **AND** the output includes build number, result, duration, timestamp, and change sets

#### Scenario: Get latest build info with explicit keyword

- **GIVEN** valid Jenkins credentials in environment
- **WHEN** the user runs `af jenkins build my-app/main latest`
- **THEN** the behavior is identical to omitting the build number

#### Scenario: Get specific build info

- **GIVEN** valid Jenkins credentials in environment
- **WHEN** the user runs `af jenkins build my-app/main 142`
- **THEN** details for build #142 are displayed

### Requirement: Console output

The CLI SHALL display full build console output.

#### Scenario: Get latest build log

- **GIVEN** valid Jenkins credentials in environment
- **WHEN** the user runs `af jenkins log my-app/main`
- **THEN** the full console output of the latest build is printed to stdout

#### Scenario: Get specific build log

- **GIVEN** valid Jenkins credentials in environment
- **WHEN** the user runs `af jenkins log my-app/main 142`
- **THEN** the full console output of build #142 is printed to stdout

#### Scenario: Console output is not truncated

- **GIVEN** valid Jenkins credentials in environment
- **AND** the build log is large
- **WHEN** the user runs `af jenkins log my-app/main`
- **THEN** the complete log is output without truncation
- **AND** the user can pipe through external tools for filtering

### Requirement: Build queue

The CLI SHALL display the Jenkins build queue.

#### Scenario: List queued items

- **GIVEN** valid Jenkins credentials in environment
- **WHEN** the user runs `af jenkins queue`
- **THEN** queued build items are displayed as a table with job name, queue time, and reason

#### Scenario: Empty queue

- **GIVEN** valid Jenkins credentials in environment
- **AND** no items are in the queue
- **WHEN** the user runs `af jenkins queue`
- **THEN** a message indicates the queue is empty

### Requirement: Pipeline stage information

The CLI SHALL display pipeline stage breakdown for a build.

#### Scenario: List pipeline stages

- **GIVEN** valid Jenkins credentials in environment
- **AND** the job is a pipeline
- **WHEN** the user runs `af jenkins stages my-app/main`
- **THEN** stages are displayed as a table with stage name, status, and duration

#### Scenario: Pipeline stages for specific build

- **GIVEN** valid Jenkins credentials in environment
- **WHEN** the user runs `af jenkins stages my-app/main 142`
- **THEN** stages for build #142 are displayed

#### Scenario: Pipeline Stage View plugin not installed

- **GIVEN** valid Jenkins credentials in environment
- **AND** the wfapi endpoint returns a 404
- **WHEN** the user runs `af jenkins stages my-app/main`
- **THEN** an error message indicates the Pipeline Stage View plugin may not be installed

### Requirement: Stage log

The CLI SHALL display the log for a specific pipeline stage.

#### Scenario: Get stage log for latest build

- **GIVEN** valid Jenkins credentials in environment
- **WHEN** the user runs `af jenkins stage-log my-app/main "Test"`
- **THEN** the log output for the "Test" stage of the latest build is displayed

#### Scenario: Get stage log for specific build

- **GIVEN** valid Jenkins credentials in environment
- **WHEN** the user runs `af jenkins stage-log my-app/main "Test" 142`
- **THEN** the log output for the "Test" stage of build #142 is displayed

#### Scenario: Stage name matching is case-insensitive

- **GIVEN** valid Jenkins credentials in environment
- **WHEN** the user runs `af jenkins stage-log my-app/main "test"`
- **THEN** it matches a stage named "Test" (case-insensitive)

#### Scenario: Stage not found

- **GIVEN** valid Jenkins credentials in environment
- **WHEN** the user runs `af jenkins stage-log my-app/main "Nonexistent"`
- **THEN** an error is displayed listing the available stage names

### Requirement: JSON output option

The CLI SHALL support JSON output for programmatic use.

#### Scenario: JSON output for job

- **GIVEN** valid Jenkins credentials in environment
- **WHEN** the user runs `af jenkins job my-app --json`
- **THEN** the raw Jenkins API response is output as JSON

#### Scenario: JSON output for build

- **GIVEN** valid Jenkins credentials in environment
- **WHEN** the user runs `af jenkins build my-app/main --json`
- **THEN** the build data is output as JSON

### Requirement: Job path resolution

The CLI SHALL resolve `/`-separated job paths to Jenkins URL structure.

#### Scenario: Simple job name

- **GIVEN** the user specifies job name `my-app`
- **WHEN** the path is resolved
- **THEN** it maps to `/job/my-app/`

#### Scenario: Nested job path

- **GIVEN** the user specifies job path `org/team/my-app/feature/auth`
- **WHEN** the path is resolved
- **THEN** it maps to `/job/org/job/team/job/my-app/job/feature/job/auth/`

### Requirement: Build number resolution

The CLI SHALL resolve build number arguments including the `latest` keyword.

#### Scenario: No build number specified

- **GIVEN** the user omits the build number argument
- **WHEN** the build URL is constructed
- **THEN** it resolves to `lastBuild` in the Jenkins API URL

#### Scenario: Explicit latest keyword

- **GIVEN** the user specifies `latest` as the build number
- **WHEN** the build URL is constructed
- **THEN** it resolves to `lastBuild` in the Jenkins API URL

#### Scenario: Numeric build number

- **GIVEN** the user specifies `142` as the build number
- **WHEN** the build URL is constructed
- **THEN** it uses `142` directly in the Jenkins API URL
