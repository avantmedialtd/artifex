## REMOVED Requirements

### Requirement: Spec command namespace exists

**Reason**: The `af spec` command namespace is being removed entirely. Its three subcommands (`propose`, `apply`, `archive`) have all been superseded by direct OPSX skill entry points and the bundled `/start-work` and `/complete-work` workflow slash commands.

**Migration**: Use the OPSX skills (`/opsx:new`, `/opsx:apply`, `/opsx:archive`) or the workflow commands (`/start-work`, `/complete-work`) directly in Claude Code.

### Requirement: Archive subcommand exists

**Reason**: Removed with the `af spec` command namespace.

**Migration**: Use `/opsx:archive [change-id]` directly. For Jira-driven workflows, `/complete-work` archives the change, transitions the Jira issue, and pushes to remote in one step.

### Requirement: Claude Code availability check

**Reason**: Removed with the `af spec archive` handler. The `/opsx:archive` skill runs inside Claude Code, so an availability check is unnecessary.

**Migration**: None.

### Requirement: Command execution with correct arguments

**Reason**: Removed with the `af spec archive` handler. There is no longer an external process to invoke.

**Migration**: None.

### Requirement: Process output and exit code handling

**Reason**: Removed with the `af spec archive` handler.

**Migration**: None.

### Requirement: Error handling for unknown subcommands

**Reason**: Removed with the `af spec` command namespace. Unknown top-level commands fall through to the standard "Unknown command" error from `router.ts`.

**Migration**: None.

### Requirement: Auto-commit after archive operation

**Reason**: Removed with the `af spec archive` handler. The bundled `/complete-work` slash command produces richer commits with structured trailers (`Issue=`, `OpenSpec-Id=`) that supersede the simple `Archive: <title>` format this requirement specified.

**Migration**: Use `/complete-work` at the end of an OpenSpec change. It runs `/opsx:archive` and then commits with proper trailers, transitions the Jira issue, and pushes to remote.

### Requirement: Git commit failure handling for archive

**Reason**: Removed with the auto-commit functionality.

**Migration**: None — `git commit` itself reports failures to stderr with a non-zero exit code.

### Requirement: Archive commit scope limitation

**Reason**: Removed with the auto-commit functionality.

**Migration**: Stage explicit paths when committing manually (e.g., `git add openspec/specs/ openspec/changes/archive/`).

### Requirement: Spec-id argument is optional

**Reason**: Removed with the `af spec archive` handler. (Originally added in the `optional-spec-id-archive` change and duplicated into this capability — the capability `spec-archive-cli-optional-id` is being removed in parallel.)

**Migration**: `/opsx:archive` accepts an optional change-id and handles the zero/one/multiple-changes cases internally.

### Requirement: Interactive change selection for archive

**Reason**: Removed with the `af spec archive` handler. The `Ink` picker (`utils/change-select-render.tsx`, `components/change-select.tsx`) is also deleted.

**Migration**: `/opsx:archive` handles change selection through its own conversational flow when multiple changes exist.
