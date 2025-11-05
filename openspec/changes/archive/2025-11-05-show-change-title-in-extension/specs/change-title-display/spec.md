# change-title-display Specification

## Purpose

Enable the VSCode extension to display human-readable proposal titles alongside change-ids in the tree view, making it easier for developers to identify and understand active changes at a glance.

## ADDED Requirements

### Requirement: Extract proposal title from proposal.md

The extension MUST extract the proposal title from the first line of each change's proposal.md file using the same logic as the CLI auto-commit feature.

#### Scenario: Title extraction from proposal with standard format

**Given** a change directory `openspec/changes/add-feature`
**And** the file `openspec/changes/add-feature/proposal.md` contains:
```markdown
# Add New Feature

This proposal describes...
```
**When** the extension reads the proposal
**Then** the extracted title is "Add New Feature"

#### Scenario: Title extraction strips "Proposal: " prefix

**Given** a change directory `openspec/changes/fix-bug`
**And** the file `openspec/changes/fix-bug/proposal.md` contains:
```markdown
# Proposal: Fix Authentication Bug

This proposal describes...
```
**When** the extension reads the proposal
**Then** the extracted title is "Fix Authentication Bug"

#### Scenario: Title extraction handles case-insensitive "Proposal: " prefix

**Given** a change directory `openspec/changes/improve-perf`
**And** the file `openspec/changes/improve-perf/proposal.md` contains:
```markdown
# proposal: Improve Database Performance

This proposal describes...
```
**When** the extension reads the proposal
**Then** the extracted title is "Improve Database Performance"

#### Scenario: Graceful fallback when proposal.md is missing

**Given** a change directory `openspec/changes/legacy-change`
**And** no proposal.md file exists in the directory
**When** the extension attempts to extract the title
**Then** the title is null
**And** the tree view displays only the change-id

#### Scenario: Graceful fallback when first line is empty

**Given** a change directory `openspec/changes/broken-proposal`
**And** the file `openspec/changes/broken-proposal/proposal.md` has an empty first line
**When** the extension attempts to extract the title
**Then** the title is null
**And** the tree view displays only the change-id

### Requirement: Display title before change-id in tree view

The extension MUST display the proposal title before the change-id in the tree view, with clear visual separation between title and change-id.

#### Scenario: Tree view displays title with change-id and progress

**Given** a change with id "add-feature"
**And** the proposal title is "Add New Feature"
**And** the change has 3 completed tasks out of 5 total tasks
**When** the tree view is rendered
**Then** the change item displays: "Add New Feature (add-feature) - 3/5 tasks completed"

#### Scenario: Tree view displays only change-id when title extraction fails

**Given** a change with id "legacy-change"
**And** title extraction returns null
**And** the change has 1 completed task out of 2 total tasks
**When** the tree view is rendered
**Then** the change item displays: "legacy-change (1/2 tasks completed)"

#### Scenario: Multiple changes display with their respective titles

**Given** three changes exist:
- "add-feature" with title "Add New Feature" (2/5 tasks)
- "fix-bug" with title "Fix Authentication Bug" (1/3 tasks)
- "legacy" with no title (0/1 tasks)
**When** the tree view is rendered
**Then** the tree displays:
- "Add New Feature (add-feature) - 2/5 tasks completed"
- "Fix Authentication Bug (fix-bug) - 1/3 tasks completed"
- "legacy (0/1 tasks completed)"

### Requirement: Copy title button

The extension MUST provide a button or action to copy the proposal title to the clipboard for each change item in the tree view.

#### Scenario: Copy button copies title to clipboard

**Given** a change with id "add-feature"
**And** the proposal title is "Add New Feature"
**When** the user clicks the "Copy Title" button next to the change
**Then** "Add New Feature" is copied to the system clipboard
**And** a notification confirms the copy action

#### Scenario: Copy button is visible in tree view

**Given** a change is displayed in the tree view with a title
**When** the user hovers over or focuses on the change item
**Then** a "Copy Title" button appears on the right side of the item

#### Scenario: Copy button is disabled when no title is available

**Given** a change with id "legacy-change"
**And** title extraction returned null
**When** the tree view is rendered
**Then** no "Copy Title" button is shown for this change

#### Scenario: Copy button shows appropriate icon

**Given** a change with a valid title
**When** the "Copy Title" button is displayed
**Then** the button shows a clipboard or copy icon from VSCode's ThemeIcon set

### Requirement: ChangeData interface includes title

The ChangeData TypeScript interface MUST include an optional title field to store the extracted proposal title.

#### Scenario: ChangeData includes title field

**Given** the ChangeData interface in `vscode-extension/src/types.ts`
**When** the interface is defined
**Then** it includes a `title?: string` field
**And** the field is optional to handle cases where title extraction fails

#### Scenario: taskParser populates title in ChangeData

**Given** the taskParser reads a change directory
**And** the proposal.md file exists with title "Add New Feature"
**When** getAllChangeData is called
**Then** the returned ChangeData object includes `title: "Add New Feature"`

#### Scenario: taskParser sets title to undefined when extraction fails

**Given** the taskParser reads a change directory
**And** title extraction returns null
**When** getAllChangeData is called
**Then** the returned ChangeData object has `title: undefined`
