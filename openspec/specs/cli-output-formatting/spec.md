# cli-output-formatting Specification

## Purpose
TBD - created by archiving change enhance-cli-ui. Update Purpose after archive.
## Requirements
### Requirement: Consistent output utility functions

The CLI MUST provide utility functions for consistent formatted output across all commands.

#### Scenario: Success messages use consistent formatting

- **GIVEN** a command completes successfully
- **WHEN** it outputs a success message
- **THEN** the message uses the success() utility function
- **AND** the output includes visual emphasis (e.g., green color, checkmark symbol)
- **AND** the format is consistent with other success messages

#### Scenario: Error messages use consistent formatting

- **GIVEN** a command encounters an error
- **WHEN** it outputs an error message
- **THEN** the message uses the error() utility function
- **AND** the output includes visual emphasis (e.g., red color, error symbol)
- **AND** the format is consistent with other error messages

#### Scenario: Info messages use consistent formatting

- **GIVEN** a command provides informational output
- **WHEN** it outputs an info message
- **THEN** the message uses the info() utility function
- **AND** the output has appropriate visual style
- **AND** the format is consistent with other info messages

### Requirement: Color support with ANSI codes

The CLI MUST support colored output using built-in ANSI escape codes without external dependencies.

#### Scenario: ANSI colors are defined

- **GIVEN** the output utilities module
- **WHEN** examining the color definitions
- **THEN** it defines standard ANSI color codes (red, green, yellow, blue, cyan, gray)
- **AND** includes a reset code to clear formatting
- **AND** does not require external color libraries

#### Scenario: Colors enhance readability

- **GIVEN** the CLI outputs various message types
- **WHEN** viewed in a color-capable terminal
- **THEN** success messages appear in green
- **AND** error messages appear in red
- **AND** warnings appear in yellow
- **AND** info messages use appropriate colors for hierarchy

#### Scenario: Colors degrade gracefully

- **GIVEN** the CLI is used in a terminal without color support
- **WHEN** colored output is attempted
- **THEN** the ANSI codes are ignored by the terminal
- **AND** the text remains readable without colors
- **AND** no errors or corruption occurs

### Requirement: Visual hierarchy in output

The CLI MUST provide utilities for creating clear visual hierarchy in command output.

#### Scenario: Section headers are visually distinct

- **GIVEN** a command outputs multiple sections
- **WHEN** using the section() or header() utility functions
- **THEN** section headers are visually distinct from body text
- **AND** use formatting like bold, colors, or spacing
- **AND** help users scan output quickly

#### Scenario: List items have consistent formatting

- **GIVEN** a command outputs a list of items
- **WHEN** using the listItem() utility function
- **THEN** list items are consistently formatted
- **AND** include appropriate symbols (e.g., •, -, ✓, ✗)
- **AND** are properly indented

#### Scenario: Summary sections stand out

- **GIVEN** a command completes with a summary
- **WHEN** the summary is displayed
- **THEN** it is visually separated from previous output
- **AND** uses formatting to draw attention (e.g., lines, spacing, colors)
- **AND** key information is emphasized

### Requirement: Error message improvements

Error messages MUST provide context and actionable information.

#### Scenario: Error messages include context

- **GIVEN** a command encounters an error
- **WHEN** the error is displayed
- **THEN** it includes information about what went wrong
- **AND** provides context about what the command was trying to do
- **AND** is more informative than just "Error: [message]"

#### Scenario: Error messages suggest solutions

- **GIVEN** a command encounters a common error (e.g., missing Claude Code)
- **WHEN** the error is displayed
- **THEN** it suggests how to fix the problem
- **AND** provides relevant commands or links
- **AND** helps the user resolve the issue without external help

#### Scenario: Error formatting is consistent

- **GIVEN** any command produces an error
- **WHEN** the error is displayed
- **THEN** it uses the standard error formatting
- **AND** includes visual emphasis (red color, error symbol)
- **AND** follows the same pattern as other errors

### Requirement: Progress and status indicators

The CLI MUST provide clear feedback during long-running operations.

#### Scenario: Long operations show status messages

- **GIVEN** a command performs a long-running operation
- **WHEN** the operation is in progress
- **THEN** the CLI outputs status messages to indicate progress
- **AND** messages describe what is currently happening
- **AND** users know the command is working, not hung

#### Scenario: Multi-step operations show progress

- **GIVEN** a command performs multiple steps (e.g., npm upgrade)
- **WHEN** each step is executed
- **THEN** the CLI outputs a message for that step
- **AND** users can follow the progression
- **AND** can identify which step succeeded or failed

#### Scenario: Operation summaries are clear

- **GIVEN** a command completes a multi-step operation
- **WHEN** the operation finishes
- **THEN** the CLI displays a summary of results
- **AND** clearly shows what succeeded
- **AND** clearly shows what failed (if anything)
- **AND** provides actionable next steps if needed

### Requirement: Consistent spacing and alignment

Output MUST use consistent spacing and alignment for professional appearance.

#### Scenario: Related output is grouped

- **GIVEN** a command outputs related information
- **WHEN** the output is displayed
- **THEN** related items are grouped together
- **AND** groups are separated by blank lines
- **AND** the visual structure reflects the logical structure

#### Scenario: Columns are aligned

- **GIVEN** a command outputs tabular or list data
- **WHEN** the output is displayed
- **THEN** columns are properly aligned
- **AND** the alignment makes the data easy to scan
- **AND** spacing is consistent across rows

#### Scenario: Output is not cluttered

- **GIVEN** any command output
- **WHEN** viewed in the terminal
- **THEN** the output is clean and uncluttered
- **AND** uses whitespace effectively
- **AND** avoids unnecessary blank lines or excessive spacing

### Requirement: Output utilities are dependency-free

All output formatting MUST be implemented without external dependencies.

#### Scenario: No color libraries required

- **GIVEN** the output utilities implementation
- **WHEN** examining the dependencies
- **THEN** it does not depend on external color libraries (chalk, colors, picocolors, etc.)
- **AND** uses only built-in ANSI escape codes
- **AND** works with Node.js standard library only

#### Scenario: No UI framework required

- **GIVEN** the output utilities implementation
- **WHEN** examining the dependencies
- **THEN** it does not depend on CLI UI frameworks (ink, blessed, etc.)
- **AND** uses standard console output methods
- **AND** maintains the project's minimal dependency philosophy

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

