# Tasks

## Implementation

- [ ] 1.1 Create utility function `listOngoingChanges()` in `utils/openspec.ts` to parse `openspec list --changes` output
- [ ] 1.2 Create `ApplyChangeSelect` Ink component in `components/apply-select.tsx` for interactive change selection
- [ ] 1.3 Update `handleSpecApply()` to check change count and show interactive select when > 1 changes exist
- [ ] 1.4 Handle edge cases: 0 changes (error), 1 change (auto-select with confirmation message)

## Validation

- [ ] 2.1 Add unit tests for `listOngoingChanges()` utility
- [ ] 2.2 Test interactive selection with multiple ongoing changes
- [ ] 2.3 Run `npm run format:check` and `npm run lint`
- [ ] 2.4 Run `npm test` to verify all tests pass
