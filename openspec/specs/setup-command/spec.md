# setup-command Specification

## Purpose
TBD - created by archiving change add-setup-command. Update Purpose after archive.
## Requirements
### Requirement: Setup Command

The CLI SHALL provide a `setup` command that copies bundled configuration files to the user's home directory (`~/.claude/`).

#### Scenario: Default setup

- **WHEN** user runs `af setup`
- **THEN** files are copied to `~/.claude/` directory

### Requirement: File Conflict Resolution

The CLI SHALL prompt users when target files already exist and provide options to resolve conflicts.

#### Scenario: Single file conflict prompt

- **WHEN** a target file already exists
- **AND** user has not selected "overwrite all" or "skip all"
- **THEN** the CLI displays the conflicting file path
- **AND** prompts with options: overwrite (y), skip (n), overwrite all (a), skip all (s)

#### Scenario: Overwrite all selection

- **WHEN** user selects "overwrite all" (a)
- **THEN** all remaining conflicting files are overwritten without further prompts

#### Scenario: Skip all selection

- **WHEN** user selects "skip all" (s)
- **THEN** all remaining conflicting files are skipped without further prompts

### Requirement: Force Mode

The CLI SHALL provide a force flag to overwrite all files without prompting.

#### Scenario: Force overwrite

- **WHEN** user runs `af setup --force` or `af setup -f`
- **THEN** all files are copied, overwriting existing files without prompts

### Requirement: List Mode

The CLI SHALL provide a list flag to preview files without copying.

#### Scenario: List files to copy

- **WHEN** user runs `af setup --list` or `af setup -l`
- **THEN** the CLI displays all files that would be copied
- **AND** indicates which files already exist in the target location
- **AND** does not copy any files

### Requirement: Standalone Binary Compatibility

The setup files SHALL be embedded in the compiled binary and accessible without external files.

#### Scenario: Compiled binary execution

- **WHEN** the compiled binary is executed with `af setup`
- **THEN** files are copied from the embedded bundle
- **AND** behavior is identical to development mode

### Requirement: Directory Structure Preservation

The CLI SHALL preserve the directory structure when copying files.

#### Scenario: Nested directory copying

- **WHEN** setup contains `setup/.claude/skills/pm/SKILL.md`
- **THEN** file is copied to `~/.claude/skills/pm/SKILL.md`
- **AND** intermediate directories are created as needed

### Requirement: Results Summary

The CLI SHALL display a summary of the setup operation.

#### Scenario: Successful setup

- **WHEN** setup completes
- **THEN** the CLI displays count of files copied
- **AND** lists files that were skipped (if any)
- **AND** reports any errors encountered

### Requirement: Dynamic File Discovery

The build process SHALL automatically discover and embed all files in the `setup/` directory without requiring code changes.

#### Scenario: Adding new setup file

- **WHEN** a new file is added to the `setup/` directory
- **AND** the project is compiled
- **THEN** the new file is included in the compiled binary
- **AND** no code changes are required

### Requirement: Multi-Agent Setup

The CLI SHALL copy configuration files to both Claude and OpenCode directories by default.

#### Scenario: Default multi-agent setup

- **WHEN** user runs `af setup`
- **THEN** command files are copied to `~/.claude/commands/`
- **AND** command files are copied to `~/.config/opencode/command/`
- **AND** skill files are copied to `~/.claude/skills/` only (OpenCode reads from this path)

### Requirement: OpenCode Path Transformation

The CLI SHALL transform paths correctly when copying commands to OpenCode.

#### Scenario: Command path transformation

- **WHEN** copying a command file to OpenCode
- **THEN** `~/.claude/commands/foo.md` becomes `~/.config/opencode/command/foo.md`
- **AND** the directory `command/` is singular (not `commands/`)

### Requirement: OpenCode List Mode

The list mode SHALL display OpenCode target paths for command files.

#### Scenario: List mode shows OpenCode paths

- **WHEN** user runs `af setup --list`
- **THEN** command files show both Claude and OpenCode target paths
- **AND** skill files show only Claude target path with note about OpenCode compatibility

