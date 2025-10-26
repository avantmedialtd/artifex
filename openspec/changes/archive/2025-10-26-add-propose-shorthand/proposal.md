# Proposal: Add 'zap propose' as a shorthand for 'zap spec propose'

## Summary

Add `zap propose` as a top-level command shorthand for `zap spec propose` to improve developer ergonomics and reduce typing friction when creating OpenSpec proposals.

## Motivation

Currently, developers must type `zap spec propose <proposal-text>` to initiate an OpenSpec proposal. This is 5 words before they even get to the proposal text. Since proposing changes is a frequent operation in the development workflow, adding a shorter `zap propose` command will:

1. **Reduce typing**: Save 5 characters (`spec `) on every proposal
2. **Improve ergonomics**: Make the most common workflow more accessible
3. **Align with convention**: Similar to how git provides shortcuts like `git co` for `git checkout` (via aliases)

The `zap spec propose` command will continue to work unchanged to maintain backward compatibility.

## Scope

This change adds a new top-level command (`propose`) while maintaining full backward compatibility with the existing `zap spec propose` command path.

### In Scope

- Add `propose` as a top-level command in main.ts
- Ensure `propose` delegates to the same `runSpecPropose` logic
- Maintain all existing validation and error handling
- Update user documentation to mention the shorthand

### Out of Scope

- Modifying the behavior of `zap spec propose`
- Adding other command shortcuts or aliases
- Changing the underlying OpenSpec proposal workflow
- Adding command alias configuration system

## Related Changes

None. This is a standalone ergonomic improvement.

## Risks and Mitigations

**Risk**: Adding top-level commands could pollute the command namespace.
**Mitigation**: This is intentional and limited to high-frequency commands. We're adding only one shortcut for the most common operation.

**Risk**: Users might be confused about which command to use.
**Mitigation**: Documentation will clarify that both forms work identically, and the shorthand is purely for convenience.

## Success Criteria

- `zap propose <text>` works identically to `zap spec propose <text>`
- All existing tests for spec propose pass
- Integration tests verify both command paths work
- Documentation mentions both command forms
