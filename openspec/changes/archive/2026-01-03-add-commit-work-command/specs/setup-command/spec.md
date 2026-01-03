## ADDED Requirements

### Requirement: Commit Work Command

The setup SHALL include a `commit-work` Claude command that commits all changes with the OpenSpec proposal title and ID as a trailer.

#### Scenario: Commit with explicit OpenSpec ID and title

- **GIVEN** the user has uncommitted changes
- **WHEN** the user runs `/commit-work add-user-auth "Add User Authentication"`
- **THEN** the command executes `af commit save "Add User Authentication" OpenSpec-Id=add-user-auth`
- **AND** all changes are staged and committed with the title as message
- **AND** the commit includes trailer `OpenSpec-Id: add-user-auth`

#### Scenario: Commit using current context

- **GIVEN** Claude is working on an OpenSpec change
- **AND** the user has uncommitted changes
- **WHEN** the user runs `/commit-work` without arguments
- **THEN** the command uses the ID and title from the current context
- **AND** executes `af commit save "<title>" OpenSpec-Id=<id>`

#### Scenario: Commit with inferred arguments when not working on a spec

- **GIVEN** Claude is not working on an OpenSpec change
- **AND** exactly one active OpenSpec change exists
- **WHEN** the user runs `/commit-work` without arguments
- **THEN** the command infers the ID from `openspec list`
- **AND** extracts the title from `openspec/changes/<id>/proposal.md`
- **AND** executes `af commit save "<title>" OpenSpec-Id=<id>`
