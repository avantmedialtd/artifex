## ADDED Requirements

### Requirement: Terminal hyperlink support

The CLI MUST provide a utility function for creating clickable hyperlinks in terminal output using the OSC 8 escape sequence.

#### Scenario: Creating a hyperlink

- **GIVEN** the output utilities module
- **WHEN** calling `link(text, url)`
- **THEN** it returns a string with OSC 8 escape sequences wrapping the text
- **AND** the text is displayed in the terminal
- **AND** the URL is hidden but clickable in supported terminals

#### Scenario: Graceful degradation in unsupported terminals

- **GIVEN** a terminal without OSC 8 support
- **WHEN** a hyperlink is displayed
- **THEN** the text is shown without the URL
- **AND** no escape sequences are visible
- **AND** output remains readable

### Requirement: Jira issue keys are clickable

Jira commands MUST display issue keys as clickable hyperlinks that open the issue in a browser.

#### Scenario: Issue key in detail view

- **GIVEN** a user runs `af jira get PROJ-123`
- **WHEN** the issue details are displayed
- **THEN** the issue key in the header is a clickable link
- **AND** clicking opens `{JIRA_BASE_URL}/browse/PROJ-123`

#### Scenario: Issue keys in list view

- **GIVEN** a user runs `af jira list PROJ`
- **WHEN** the issue list is displayed
- **THEN** each issue key in the table is a clickable link
- **AND** clicking opens the corresponding issue in Jira

#### Scenario: Issue key in success messages

- **GIVEN** a user creates, updates, or modifies an issue
- **WHEN** the success message is displayed
- **THEN** the issue key in the message is a clickable link
- **AND** clicking opens the issue in Jira

#### Scenario: Parent and subtask keys are clickable

- **GIVEN** an issue has a parent or subtasks
- **WHEN** the issue details are displayed
- **THEN** the parent issue key is a clickable link
- **AND** each subtask key is a clickable link

### Requirement: Jira project keys are clickable

Jira commands MUST display project keys as clickable hyperlinks that open the project in Jira.

#### Scenario: Project keys in project list

- **GIVEN** a user runs `af jira projects`
- **WHEN** the project list is displayed
- **THEN** each project key is a clickable link
- **AND** clicking opens the project board in Jira
