# Spec: Ink Output Components

## ADDED Requirements

### Requirement: Basic output components

The system MUST provide Ink-based replacements for all existing output utility functions.

#### Scenario: Success message component

**Given** a command needs to display a success message
**When** rendering a success message
**Then** the component MUST display text in green color
**And** the component MUST accept a message string as input
**And** the visual appearance MUST match the current `success()` function output

#### Scenario: Error message component

**Given** a command needs to display an error message
**When** rendering an error message
**Then** the component MUST display text in red color
**And** the component MUST accept a message string as input
**And** the visual appearance MUST match the current `error()` function output
**And** errors MUST be written to stderr, not stdout

#### Scenario: Info message component

**Given** a command needs to display informational text
**When** rendering an info message
**Then** the component MUST display text in cyan color
**And** the component MUST accept a message string as input
**And** the visual appearance MUST match the current `info()` function output

#### Scenario: Warning message component

**Given** a command needs to display a warning
**When** rendering a warning message
**Then** the component MUST display text in yellow color
**And** the component MUST accept a message string as input
**And** the visual appearance MUST match the current `warn()` function output

### Requirement: Layout components

The system MUST provide Ink components for structured layout and formatting.

#### Scenario: Header component

**Given** a command needs to display a section header
**When** rendering a header
**Then** the component MUST display text in blue color with emphasis
**And** the component MUST include vertical spacing (newline before)
**And** the visual appearance MUST match the current `header()` function output

#### Scenario: Section component

**Given** a command needs to display a subsection
**When** rendering a section
**Then** the component MUST display text in cyan color
**And** the component MUST include vertical spacing (newline before)
**And** the visual appearance MUST match the current `section()` function output

#### Scenario: List item component

**Given** a command needs to display list items
**When** rendering a list item
**Then** the component MUST display an optional symbol prefix (default: '•')
**And** the symbol MUST be rendered in gray color
**And** the component MUST support custom symbols
**And** the item MUST be indented with 2 spaces
**And** the visual appearance MUST match the current `listItem()` function output

### Requirement: Backward compatibility wrapper

The system MUST provide backward-compatible function wrappers for existing output.ts API.

#### Scenario: Legacy function call compatibility

**Given** existing command handlers use `output.success()`, `output.error()`, etc.
**When** those functions are called
**Then** the wrapper MUST render the appropriate Ink component
**And** the wrapper MUST block until rendering completes
**And** the wrapper MUST maintain the same function signature
**And** existing command handlers MUST work without modification
