# Auto-commit proposals after creation

## Problem Statement

Currently, when developers run `zap propose` (which invokes `/openspec:proposal`), the OpenSpec proposal is created but not automatically committed to git. This creates friction in the development workflow because:

- Developers must manually commit the proposal files after creation
- The commit message must follow a specific format: "Propose: &lt;Title&gt;"
- Extracting the title from the proposal.md file is manual and error-prone
- The workflow is inconsistent with other OpenSpec commands that may auto-commit

This manual step slows down the proposal workflow and increases cognitive overhead for developers who need to remember the commit message format and manually extract the title.

## Proposed Solution

Automatically commit proposal files after the `/openspec:proposal` command completes successfully. The commit message should follow the format "Propose: &lt;Title&gt;" where:

- The title is extracted from the first line of the generated `proposal.md` file
- The leading `#` and any whitespace is stripped
- The optional "Proposal: " prefix is stripped if present

For example, if the proposal.md first line is:
```
# Proposal: Show help page if no argument is provided
```

The commit message should be:
```
Propose: Show help page if no argument is provided
```

## User Value

- **Faster workflow**: No manual commit step after creating proposals
- **Consistency**: All proposals have properly formatted commit messages
- **Reduced errors**: No risk of forgetting to commit or using wrong format
- **Better developer experience**: Less friction in the proposal creation process

## Scope

This change modifies the spec-propose-cli specification to add automatic git commit after proposal creation.

### In Scope

- Automatically committing proposal files after `/openspec:proposal` succeeds
- Extracting the title from the first line of proposal.md
- Stripping leading `#` and "Proposal: " prefix from the title
- Using the format "Propose: &lt;Title&gt;" for the commit message
- Only committing if the proposal was successfully created

### Out of Scope

- Modifying commit messages for other OpenSpec commands
- Adding git push functionality
- Modifying the proposal.md format or content
- Changing how `/openspec:proposal` creates proposals

## Implementation Approach

The implementation requires:

1. The `/openspec:proposal` command should automatically commit after creating the proposal
2. Read the first line of the generated `openspec/changes/&lt;change-id&gt;/proposal.md` file
3. Parse the title by:
   - Removing leading `#` and whitespace
   - Removing "Proposal: " prefix if present
   - Trimming any extra whitespace
4. Stage all files in `openspec/changes/&lt;change-id&gt;/`
5. Create a commit with message "Propose: &lt;Title&gt;"
6. Exit with code 0 if commit succeeds, 1 if it fails

## Risks and Mitigation

**Risk**: Commit might fail if there are unstaged changes or git configuration issues
- **Likelihood**: Low - only affects files in the change directory
- **Mitigation**: Show clear error messages if commit fails, let the proposal files remain uncommitted so user can manually commit

**Risk**: Title extraction might fail if proposal.md format is unexpected
- **Likelihood**: Very low - OpenSpec controls the proposal.md format
- **Mitigation**: Use robust parsing logic and fall back to a generic message if extraction fails

## Success Criteria

- Running `zap propose &lt;text&gt;` creates the proposal and commits it automatically
- Commit message follows the format "Propose: &lt;Title&gt;"
- Title is correctly extracted from proposal.md first line
- Leading `#` and "Proposal: " prefix are correctly stripped
- Only files in the change directory are committed
- Exit code is 0 on success, 1 on failure
- Clear error messages if commit fails
