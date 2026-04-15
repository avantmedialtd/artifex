## REMOVED Requirements

### Requirement: Propose subcommand exists

**Reason**: The `af spec propose` command and its underlying handler are being removed. The OPSX skill workflow (`/opsx:new`) and the bundled `/start-work` slash command provide richer entry points for creating OpenSpec proposals.

**Migration**: Use `/opsx:new <change-name>` (or `/opsx:ff <change-name>` to fast-forward through artifact creation) directly in Claude Code. For Jira-driven workflows, use `/start-work [issue-key]` which assigns the issue, transitions it, and creates the OpenSpec change in one step.

### Requirement: Proposal text argument is required

**Reason**: Removed with the `af spec propose` handler.

**Migration**: The OPSX skills accept a change name and infer intent from the surrounding conversation; there is no equivalent "proposal text argument".

### Requirement: Multi-word proposal text handling

**Reason**: Removed with the `af spec propose` handler.

**Migration**: None — slash commands handle multi-word arguments natively.

### Requirement: Claude Code availability check

**Reason**: Removed with the `af spec propose` handler. The OPSX entry points run inside Claude Code, so an availability check is unnecessary.

**Migration**: None.

### Requirement: Command execution with correct arguments

**Reason**: Removed with the `af spec propose` handler. There is no longer an external process to invoke.

**Migration**: None.

### Requirement: Process output and exit code handling

**Reason**: Removed with the `af spec propose` handler.

**Migration**: None.

### Requirement: Integration with existing spec command

**Reason**: The entire `af spec` command namespace is being removed.

**Migration**: None.

### Requirement: Auto-commit after proposal creation

**Reason**: Removed with the `af spec propose` handler. The bundled `/complete-work` slash command produces richer commits with structured trailers (`Issue=`, `OpenSpec-Id=`) that supersede the simple `Propose: <title>` format this requirement specified.

**Migration**: Use `/complete-work` at the end of an OpenSpec change to produce a commit with proper trailers, or commit manually with `git commit -m "Propose: <title>"` if a propose-stage commit is desired.

### Requirement: Git commit failure handling

**Reason**: Removed with the auto-commit functionality.

**Migration**: None — `git commit` itself reports failures to stderr with a non-zero exit code.

### Requirement: Commit scope limitation

**Reason**: Removed with the auto-commit functionality.

**Migration**: Stage explicit paths when committing manually (e.g., `git add openspec/changes/<id>/`).
