## REMOVED Requirements

### Requirement: Commit command namespace exists

**Reason**: The `af commit` CLI wrapper has been removed. `git commit --trailer` provides the same functionality natively, and the three workflow slash commands that depended on `af commit` have been rewritten to invoke `git` directly.

**Migration**: Use `git commit` directly. For the apply-style workflow that generated a commit message from a change title, use:

```bash
git add -A
git commit -m "Apply: <change-title>"
```

Where `<change-title>` is the first line of `openspec/changes/<change-id>/proposal.md` with the leading `#` and optional "Proposal: " prefix stripped.

### Requirement: Commit apply subcommand exists

**Reason**: Removed with the `af commit` namespace. See migration above.

**Migration**: Inline the `git add -A && git commit -m "Apply: <title>"` invocation.

### Requirement: Change-id argument is optional

**Reason**: The interactive change picker was only useful inside `af commit apply`. With the command removed, callers now supply the change ID explicitly.

**Migration**: Resolve the change ID before committing, either from the `openspec list` output or from the caller's own context.

### Requirement: Interactive change selection for commit

**Reason**: Removed with `af commit apply`. No replacement is planned — the workflow slash commands always know the change ID they are committing for.

**Migration**: Supply the change ID explicitly. If a human needs to pick one, run `openspec list` and copy the ID.

### Requirement: Commit message format

**Reason**: Moved out of Artifex. The "Apply: <title>" convention is still recommended for OpenSpec-related commits but is no longer enforced by a CLI command.

**Migration**: Callers that want the "Apply: " prefix must construct the message themselves before invoking `git commit`.

### Requirement: Shorthand commit command

**Reason**: Removed with the `af commit` namespace.

**Migration**: None — type `git commit` directly.

### Requirement: Git commit failure handling

**Reason**: Removed with the `af commit` namespace. `git commit` itself already reports failures to stderr with a non-zero exit code.

**Migration**: Rely on git's native error reporting.

### Requirement: Title extraction failure handling

**Reason**: Removed with the `af commit` namespace.

**Migration**: Callers that need to extract a title from a proposal can read `openspec/changes/<id>/proposal.md` directly and strip the leading `#` / "Proposal: " prefix.

### Requirement: Help content for commit command

**Reason**: Removed because the command no longer exists.

**Migration**: None. `af help` no longer lists `commit`.
