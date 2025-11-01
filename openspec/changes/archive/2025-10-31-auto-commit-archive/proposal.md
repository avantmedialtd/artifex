# Auto-commit archive operations

## Problem Statement

Currently, when developers run `zap spec archive <spec-id>` (which invokes `/openspec:archive`), the archive operation completes but the changes are not automatically committed to git. This creates inconsistency with the `zap spec propose` workflow and adds friction:

- The `propose` command automatically commits proposal files after creation
- The `archive` command requires manual git commits after archiving
- Developers must manually commit with an appropriate message format
- The workflow is inconsistent across different spec commands

This manual step slows down the archive workflow and creates an inconsistent developer experience compared to the propose workflow.

## Proposed Solution

Automatically commit archive changes after the `/openspec:archive` command completes successfully. The commit message should follow the format "Archive: <Title>" where:

- The title is extracted from the first line of the archived spec's `proposal.md` file
- The leading `#` and any whitespace is stripped
- The optional "Proposal: " prefix is stripped if present
- The same title extraction logic used for `propose` is reused

For example, if archiving a proposal with first line:
```
# Proposal: Add CLI executable
```

The commit message should be:
```
Archive: Add CLI executable
```

## User Value

- **Consistency**: Archive and propose commands both auto-commit
- **Faster workflow**: No manual commit step after archiving changes
- **Reduced errors**: No risk of forgetting to commit archive operations
- **Better developer experience**: Unified behavior across spec commands

## Scope

This change modifies the spec-archive-cli specification to add automatic git commit after archive operations.

### In Scope

- Automatically committing archive changes after `/openspec:archive` succeeds
- Reusing existing title extraction logic from proposal utilities
- Using the format "Archive: <Title>" for the commit message
- Only committing files in the archived spec directory
- Handling commit failures gracefully with clear warnings

### Out of Scope

- Modifying the `/openspec:archive` command behavior
- Adding git push functionality
- Changing archive file formats or structure
- Modifying other spec commands (propose/apply)

## Implementation Approach

The implementation requires:

1. Modify `handleSpecArchive` in `commands/spec.ts` to add auto-commit logic after successful archive
2. Extract the title from the archived spec's `proposal.md` file using existing `extractProposalTitle` utility
3. Stage all files in the archived spec directory
4. Create a commit with message "Archive: <Title>"
5. Show success message or warning if commit fails
6. Exit with appropriate status code

The implementation closely mirrors the existing auto-commit logic in `handleSpecPropose`, ensuring consistency and code reuse.

## Risks and Mitigation

**Risk**: Commit might fail if there are git configuration issues
- **Likelihood**: Low - only affects files in the spec directory
- **Mitigation**: Show clear warning messages if commit fails, allow manual commit

**Risk**: Title extraction might fail if proposal.md is not in expected location
- **Likelihood**: Very low - OpenSpec controls the archive structure
- **Mitigation**: Use existing robust parsing logic and show warning if extraction fails

## Success Criteria

- Running `zap spec archive <spec-id>` archives the spec and commits it automatically
- Commit message follows the format "Archive: <Title>"
- Title is correctly extracted from the archived proposal.md
- Only files in the archived spec directory are committed
- Clear warning messages if commit fails
- Exit code is 0 on success (even if commit warning occurs)
- Auto-commit behavior matches the existing `propose` command pattern
