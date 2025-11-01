# Make spec-id optional in 'zap archive'

## Problem

Currently, `zap spec archive` requires a spec-id argument. This creates friction in the workflow because developers must:

1. Remember or look up the exact spec-id they want to archive
2. Type the spec-id manually, risking typos

This is similar to the workflow issue that was solved for `zap spec apply`, which now supports running without a change-id and lets Claude Code prompt interactively.

## Solution

Make the spec-id argument optional in `zap spec archive`, following the same pattern as `zap spec apply`:

- When spec-id is provided: `zap spec archive <spec-id>` works as it does today
- When spec-id is omitted: `zap spec archive` invokes Claude Code without the spec-id, allowing Claude to prompt the user to select which spec to archive

This maintains backward compatibility while providing a more convenient workflow for developers who don't have the spec-id memorized.

## Implementation Strategy

The change is straightforward:

1. Update `handleSpecArchive()` in `commands/spec.ts` to remove the spec-id validation
2. Update the slash command construction to conditionally include spec-id
3. Update error messages and help text to reflect optional argument
4. Adjust auto-commit logic to handle the case where spec-id might not be known upfront (Claude provides it after selection)

## Success Criteria

- `zap spec archive` without arguments successfully invokes Claude and allows interactive spec selection
- `zap spec archive <spec-id>` continues to work as before
- Auto-commit functionality works correctly in both cases
- Error handling and help text accurately reflect the optional argument
