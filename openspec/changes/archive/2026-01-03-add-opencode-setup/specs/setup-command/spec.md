# setup-command Specification Delta

## ADDED Requirements

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
