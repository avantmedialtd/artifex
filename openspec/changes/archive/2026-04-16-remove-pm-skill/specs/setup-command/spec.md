## MODIFIED Requirements

### Requirement: Directory Structure Preservation

The CLI SHALL preserve the directory structure when copying files.

#### Scenario: Nested directory copying

- **WHEN** the setup bundle contains a file at a nested path such as `<subdirectory>/<file>.md`
- **THEN** the file is copied to the matching nested path under `~/.claude/`
- **AND** intermediate directories are created as needed
