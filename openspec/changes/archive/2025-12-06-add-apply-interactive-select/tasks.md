# Tasks

## Implementation

- [x] 1.1 Create utility function `listOngoingChanges()` in `utils/openspec.ts` to parse `openspec list --changes` output
- [x] 1.2 Create `ApplyChangeSelect` Ink component in `components/apply-select.tsx` for interactive change selection
- [x] 1.3 Update `handleSpecApply()` to check change count and show interactive select when > 1 changes exist
- [x] 1.4 Handle edge cases: 0 changes (error), 1 change (auto-select with confirmation message)

## Validation

- [x] 2.1 Add unit tests for `listOngoingChanges()` utility
- [x] 2.2 Test interactive selection with multiple ongoing changes
- [x] 2.3 Run `npm run format:check` and `npm run lint`
- [x] 2.4 Run `npm test` to verify all tests pass
