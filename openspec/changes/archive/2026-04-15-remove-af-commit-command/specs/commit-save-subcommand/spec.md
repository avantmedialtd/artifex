## REMOVED Requirements

### Requirement: Commit save subcommand exists

**Reason**: The `af commit save` wrapper has been removed. `git commit --trailer "Key=Value"` provides the identical behavior natively, and the three workflow slash commands that depended on this subcommand have been rewritten to invoke `git` directly.

**Migration**: Replace any invocation of

```bash
af commit save "<message>" Key1=Value1 Key2=Value2
```

with

```bash
git add -A
git commit -m "<message>" \
  --trailer "Key1=Value1" \
  --trailer "Key2=Value2"
```

### Requirement: Trailer syntax uses Key=Value format

**Reason**: Removed with `af commit save`. `git commit --trailer` already accepts `Key=Value` format directly, so no translation layer is needed.

**Migration**: Pass `Key=Value` pairs directly to `git commit` using one `--trailer` flag per pair.

### Requirement: Message argument is required

**Reason**: Removed with `af commit save`. `git commit -m` already enforces that a message is provided (either inline with `-m` or via the editor).

**Migration**: Use `git commit -m "<message>"`.

### Requirement: Git commit failure handling

**Reason**: Removed with `af commit save`. Git's native error reporting covers the same cases.

**Migration**: Rely on git's native error reporting and exit codes.

### Requirement: Help content for commit save

**Reason**: Removed because the subcommand no longer exists.

**Migration**: None. `af help` no longer lists `commit save`.
