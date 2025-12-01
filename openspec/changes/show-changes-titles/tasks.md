## 1. Implementation

- [ ] 1.1 Remove debug console.log statements from `utils/proposal.ts`
- [ ] 1.2 Create `getActiveChanges()` function to read change directories and their task counts
- [ ] 1.3 Update `handleChanges()` to use custom output instead of delegating to `openspec list`
- [ ] 1.4 Format each change line with title (when available), change ID, and task progress
- [ ] 1.5 Ensure graceful fallback when title extraction fails

## 2. Testing

- [ ] 2.1 Test with changes that have valid proposal.md files
- [ ] 2.2 Test with changes missing proposal.md
- [ ] 2.3 Test with empty changes directory
- [ ] 2.4 Verify output formatting matches spec scenarios
