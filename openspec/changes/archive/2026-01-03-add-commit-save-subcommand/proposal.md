# Add Commit Save Subcommand

## Why

Developers frequently need to make quick commits with a message and optional git trailers (e.g., Issue references, Co-authored-by). Currently, this requires running multiple git commands manually. A dedicated `commit save` subcommand streamlines this workflow by:

1. Staging all changes (`git add .`)
2. Creating a commit with the provided message
3. Optionally appending any number of git trailers using `Key=Value` syntax

This aligns with the existing `commit apply` subcommand pattern but serves a different use case: general-purpose commits without requiring an OpenSpec change.

## What Changes

### New Subcommand

- **`af commit save "<message>" [Key=Value...]`**: Stage all changes and commit with the provided message. Any additional arguments in `Key=Value` format are added as git trailers.

### Examples

```bash
# Simple commit
af commit save "Fix login button styling"

# Commit with single trailer
af commit save "Fix bug in parser" Issue=PROJ-123

# Commit with multiple trailers
af commit save "Add feature" Issue=PROJ-456 Reviewed-by=alice Co-authored-by="Bob Smith <bob@example.com>"
```

## Impact

- **Low risk**: Adds a new subcommand without modifying existing functionality
- **Consistent UX**: Follows the established `commit <subcommand>` pattern
- **No breaking changes**: Existing `commit apply` behavior is unchanged
