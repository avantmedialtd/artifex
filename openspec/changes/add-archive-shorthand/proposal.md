# Proposal: Add 'zap archive' as a shorthand for 'zap spec archive'

## Summary

Add `zap archive` as a top-level command shorthand for `zap spec archive` to improve developer ergonomics and reduce typing friction when archiving deployed OpenSpec changes.

## Motivation

Currently, developers must type `zap spec archive <spec-id>` to archive a deployed change. Following the successful introduction of `zap propose` as a shorthand for `zap spec propose`, adding an `archive` shorthand will:

1. **Reduce typing**: Save 5 characters (`spec `) on every archive operation
2. **Improve ergonomics**: Make the archiving workflow more accessible
3. **Consistency**: Align with the existing `propose` shorthand pattern
4. **Improve discoverability**: Top-level commands are easier to discover than nested subcommands

The `zap spec archive` command will continue to work unchanged to maintain backward compatibility.

## Scope

This change adds a new top-level command (`archive`) while maintaining full backward compatibility with the existing `zap spec archive` command path.

### In Scope

- Add `archive` as a top-level command in main.ts
- Ensure `archive` delegates to the same `runSpecArchive` logic
- Maintain all existing validation and error handling
- Update cli-command-shortcuts spec with archive shorthand requirements

### Out of Scope

- Modifying the behavior of `zap spec archive`
- Adding other command shortcuts or aliases
- Changing the underlying OpenSpec archive workflow
- Adding command alias configuration system

## Related Changes

This builds upon the pattern established by the `add-propose-shorthand` change, which introduced `zap propose` as a shorthand.

## Risks and Mitigations

**Risk**: Adding top-level commands could pollute the command namespace.
**Mitigation**: This is intentional and limited to high-frequency commands. We're following the established pattern and adding shortcuts only for common OpenSpec operations.

**Risk**: Users might be confused about which command to use.
**Mitigation**: Documentation will clarify that both forms work identically, and the shorthand is purely for convenience. This is consistent with the existing `propose` shorthand.

## Success Criteria

- `zap archive <spec-id>` works identically to `zap spec archive <spec-id>`
- All existing tests for spec archive pass
- Integration tests verify both command paths work
- cli-command-shortcuts spec is updated with archive shorthand requirements
