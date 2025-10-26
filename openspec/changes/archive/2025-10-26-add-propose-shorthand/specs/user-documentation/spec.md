# user-documentation Specification Delta

## MODIFIED Requirements

### Requirement: Usage examples and available commands

Documentation MUST include command shortcuts where they exist to help users discover the most ergonomic command forms.

#### Scenario: Developer wants to know about propose command options

- **GIVEN** the README.md file is open
- **WHEN** the developer reads the "Available Commands" section
- **THEN** they see both `zap propose <proposal-text>` and `zap spec propose <proposal-text>` listed
- **AND** the documentation indicates they are equivalent
- **AND** the shorthand `zap propose` is presented as the preferred form for brevity
