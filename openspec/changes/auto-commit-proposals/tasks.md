# Implementation Tasks

## Tasks

- [ ] Modify `/openspec:proposal` slash command to auto-commit after proposal creation
  - Add logic to detect when proposal creation completes successfully
  - Extract change-id from the proposal creation output or context
  - Read first line from `openspec/changes/<change-id>/proposal.md`
  - Parse title by stripping `#`, whitespace, and optional "Proposal: " prefix
  - Stage files in `openspec/changes/<change-id>/` directory
  - Create commit with message "Propose: <Title>"
  - Handle errors gracefully with clear messages

- [ ] Add utility function for extracting proposal title from proposal.md
  - Create a utility to read first line of proposal.md
  - Strip leading `#` and whitespace
  - Strip "Proposal: " prefix if present
  - Return cleaned title string
  - Handle edge cases (empty file, malformed first line)

- [ ] Add git commit utility function
  - Create utility to stage files in a specific directory
  - Create utility to commit staged files with a message
  - Return success/failure status
  - Capture and return error messages from git

- [ ] Add tests for title extraction
  - Test extraction with "# Proposal: Title" format
  - Test extraction with "# Title" format
  - Test with extra whitespace
  - Test with malformed input

- [ ] Add tests for auto-commit functionality
  - Mock git commands
  - Test successful commit flow
  - Test commit failure handling
  - Test that only proposal files are staged

- [ ] Update documentation
  - Update CLAUDE.md to document auto-commit behavior
  - Update any user-facing documentation about `zap propose`

- [ ] Manual testing
  - Test `zap propose` creates proposal and commits automatically
  - Verify commit message format is correct
  - Test with various proposal titles
  - Test error handling when commit fails

## Dependencies

- No external dependencies required
- Git must be available in the environment (already required for OpenSpec workflow)

## Validation

- All tests pass
- `npm run lint` passes
- `npm run format:check` passes
- `npm run spell:check` passes
- Manual testing confirms auto-commit works correctly
- Commit message format matches "Propose: <Title>" pattern
