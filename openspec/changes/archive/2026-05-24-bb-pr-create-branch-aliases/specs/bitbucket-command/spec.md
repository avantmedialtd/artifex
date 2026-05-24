## MODIFIED Requirements

### Requirement: Pull request creation

The CLI SHALL create a pull request, with sensible defaults for source and target branches. The source branch MAY be supplied via `--from`, `--source`, or `--src` (all equivalent). The target branch MAY be supplied via `--to`, `--destination`, or `--dest` (all equivalent). When multiple equivalent flags are supplied in the same invocation, the value occurring later on the command line SHALL be used.

#### Scenario: Default source branch is current branch

- **GIVEN** the working directory is on branch `feature/x`
- **AND** no `--from` flag is supplied
- **WHEN** the user runs `af bitbucket pr create --title T`
- **THEN** the source branch in the request body is `feature/x`

#### Scenario: Default target is repository main branch

- **GIVEN** no `--to` flag is supplied
- **AND** the repository's main branch is `main`
- **WHEN** the user runs `af bitbucket pr create --title T`
- **THEN** the destination branch in the request body is `main`

#### Scenario: Description from inline flag

- **WHEN** the user runs `af bitbucket pr create --title T --description "Body"`
- **THEN** the request body's description field is `Body`

#### Scenario: Description from file

- **WHEN** the user runs `af bitbucket pr create --title T --description-file ./body.md`
- **THEN** the request body's description field is the contents of `body.md`

#### Scenario: Reviewers by account id

- **WHEN** the user runs `af bitbucket pr create --title T --reviewers a1,a2`
- **THEN** the request body's `reviewers` field is `[{account_id: "a1"}, {account_id: "a2"}]`

#### Scenario: Draft pull request

- **WHEN** the user runs `af bitbucket pr create --title T --draft`
- **THEN** the request body's `draft` field is `true`

#### Scenario: Source branch via `--source` alias

- **WHEN** the user runs `af bitbucket pr create --title T --source feature/x`
- **THEN** the source branch in the request body is `feature/x`

#### Scenario: Source branch via `--src` alias

- **WHEN** the user runs `af bitbucket pr create --title T --src feature/x`
- **THEN** the source branch in the request body is `feature/x`

#### Scenario: Destination branch via `--destination` alias

- **WHEN** the user runs `af bitbucket pr create --title T --destination develop`
- **THEN** the destination branch in the request body is `develop`

#### Scenario: Destination branch via `--dest` alias

- **WHEN** the user runs `af bitbucket pr create --title T --dest develop`
- **THEN** the destination branch in the request body is `develop`

#### Scenario: Later flag wins when canonical and alias conflict

- **WHEN** the user runs `af bitbucket pr create --title T --to main --dest develop`
- **THEN** the destination branch in the request body is `develop`

#### Scenario: Earlier flag is overridden by later canonical flag

- **WHEN** the user runs `af bitbucket pr create --title T --src feature/a --from feature/b`
- **THEN** the source branch in the request body is `feature/b`
