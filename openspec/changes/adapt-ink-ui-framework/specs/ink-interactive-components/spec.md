# Spec: Ink Interactive Components

## ADDED Requirements

### Requirement: Progress indicators

The system MUST provide components for displaying progress during long-running operations.

#### Scenario: Spinner component

**Given** a command is performing a long-running operation
**When** displaying progress feedback
**Then** the system MUST provide a `<Spinner>` component
**And** the spinner MUST animate continuously until operation completes
**And** the spinner MUST support custom text labels
**And** the spinner MUST support different spinner styles (dots, line, etc.)

#### Scenario: Progress bar component

**Given** a command has quantifiable progress (e.g., file processing)
**When** displaying progress percentage
**Then** the system MUST provide a `<ProgressBar>` component
**And** the progress bar MUST accept current and total values
**And** the progress bar MUST display percentage and visual bar
**And** the progress bar MUST update in real-time as progress changes

### Requirement: Interactive input components

The system MUST provide components for gathering user input interactively.

#### Scenario: Text input component

**Given** a command needs user text input
**When** prompting for input
**Then** the system MUST provide a `<TextInput>` component
**And** the input MUST support placeholder text
**And** the input MUST support controlled value updates
**And** the input MUST invoke callback on value change
**And** the input MUST invoke callback on submit (Enter key)

#### Scenario: Select/choice component

**Given** a command needs user to choose from options
**When** displaying a selection menu
**Then** the system MUST provide a `<Select>` or choice component
**And** the component MUST support keyboard navigation (up/down arrows)
**And** the component MUST highlight the selected option
**And** the component MUST invoke callback when user confirms selection
**And** the component MUST support both single and multi-select modes

#### Scenario: Confirmation prompt component

**Given** a command needs yes/no confirmation
**When** prompting for confirmation
**Then** the system MUST provide a confirmation component
**And** the component MUST accept y/n or yes/no input
**And** the component MUST provide default value option
**And** the component MUST invoke callback with boolean result

### Requirement: Real-time display components

The system MUST provide components for live-updating displays.

#### Scenario: Live data table component

**Given** a command displays tabular data that updates over time
**When** rendering the table
**Then** the system MUST provide a table component with Flexbox layout
**And** the table MUST support column headers
**And** the table MUST support automatic column width calculation
**And** the table MUST re-render when data changes
**And** the table MUST maintain consistent layout during updates

#### Scenario: Multi-line status display

**Given** a command tracks multiple concurrent operations
**When** displaying status for each operation
**Then** the system MUST support multiple status lines that update independently
**And** each status line MUST be able to update without re-rendering others
**And** the display MUST use `<Box>` with Flexbox for layout
**And** the display MUST handle terminal resize gracefully
