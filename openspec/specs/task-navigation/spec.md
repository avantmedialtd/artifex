# task-navigation Specification

## Purpose
TBD - created by archiving change add-task-click-navigation. Update Purpose after archive.
## Requirements
### Requirement: Track line numbers during task parsing

The task parser MUST capture and store the line number where each task checkbox appears in the `tasks.md` file.

#### Scenario: Parse task with line number

**Given** a `tasks.md` file contains the following content:
```markdown

