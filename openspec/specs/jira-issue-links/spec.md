# jira-issue-links Specification

## Purpose
Issue-to-issue linking — display, create, and remove typed directional links (blocks, duplicates, relates to, etc.) between Jira issues.
## Requirements
### Requirement: Issue link display

The CLI SHALL display issue links when viewing a single issue with `af jira get`.

#### Scenario: Issue with outward links

- **GIVEN** issue PROJ-123 has an outward link of type "Blocks" to PROJ-456
- **WHEN** the user runs `af jira get PROJ-123`
- **THEN** the output includes a "Linked Issues" section
- **AND** the section contains a line showing the outward label "Blocks", the target issue key PROJ-456, its summary, and its status

#### Scenario: Issue with inward links

- **GIVEN** issue PROJ-456 has an inward link of type "is blocked by" from PROJ-123
- **WHEN** the user runs `af jira get PROJ-456`
- **THEN** the output includes a "Linked Issues" section
- **AND** the section contains a line showing the inward label "is blocked by", the source issue key PROJ-123, its summary, and its status

#### Scenario: Issue with multiple links

- **GIVEN** issue PROJ-123 has links to PROJ-456 ("Blocks") and PROJ-789 ("Relates")
- **WHEN** the user runs `af jira get PROJ-123`
- **THEN** all links are displayed in the "Linked Issues" section

#### Scenario: Issue with no links

- **GIVEN** issue PROJ-123 has no issue links
- **WHEN** the user runs `af jira get PROJ-123`
- **THEN** the "Linked Issues" section is omitted

#### Scenario: Issue links with JSON output

- **GIVEN** issue PROJ-123 has issue links
- **WHEN** the user runs `af jira get PROJ-123 --json`
- **THEN** the raw issue JSON includes the `issuelinks` field

### Requirement: Create issue link

The CLI SHALL support creating a typed link between two Jira issues via `af jira link`.

#### Scenario: Create link with default type

- **GIVEN** valid Jira credentials in environment
- **WHEN** the user runs `af jira link PROJ-123 --to PROJ-456`
- **THEN** a "Blocks" link is created from PROJ-123 to PROJ-456
- **AND** a success message is displayed

#### Scenario: Create link with explicit type

- **GIVEN** valid Jira credentials in environment
- **WHEN** the user runs `af jira link PROJ-123 --to PROJ-456 --type "Relates"`
- **THEN** a "Relates" link is created from PROJ-123 to PROJ-456
- **AND** a success message is displayed

#### Scenario: Create link missing target

- **GIVEN** valid Jira credentials in environment
- **WHEN** the user runs `af jira link PROJ-123`
- **THEN** an error is displayed indicating --to is required
- **AND** the CLI exits with code 1

#### Scenario: Create link missing issue key

- **GIVEN** valid Jira credentials in environment
- **WHEN** the user runs `af jira link`
- **THEN** an error is displayed indicating an issue key is required
- **AND** the CLI exits with code 1

### Requirement: Remove issue link

The CLI SHALL support removing a link between two issues via `af jira unlink`.

#### Scenario: Remove link by target key

- **GIVEN** valid Jira credentials in environment
- **AND** PROJ-123 has a link to PROJ-456
- **WHEN** the user runs `af jira unlink PROJ-123 --from PROJ-456`
- **THEN** the link between PROJ-123 and PROJ-456 is deleted
- **AND** a success message is displayed

#### Scenario: Remove link when no matching link exists

- **GIVEN** valid Jira credentials in environment
- **AND** PROJ-123 has no link to PROJ-999
- **WHEN** the user runs `af jira unlink PROJ-123 --from PROJ-999`
- **THEN** an error is displayed indicating no link was found to PROJ-999

#### Scenario: Remove link missing --from

- **GIVEN** valid Jira credentials in environment
- **WHEN** the user runs `af jira unlink PROJ-123`
- **THEN** an error is displayed indicating --from is required
- **AND** the CLI exits with code 1
