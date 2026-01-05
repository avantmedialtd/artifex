## 1. File Organization

- [x] 1.1 Create `resources/` directory
- [x] 1.2 Move `copy-prompt-reporter.ts` to `resources/copy-prompt-reporter.ts`

## 2. Manifest Generator Update

- [x] 2.1 Update `scripts/generate-setup-manifest.ts` to scan `resources/` directory
- [x] 2.2 Generate `RESOURCE_FILES` array alongside `SETUP_FILES`
- [x] 2.3 Regenerate manifest with `bun run generate:manifest`

## 3. Resource Utility

- [x] 3.1 Create `utils/resources.ts` with `extractResource()` function
- [x] 3.2 Handle both development mode (file on disk) and compiled mode (embedded)

## 4. E2E Script Integration

- [x] 4.1 Update `scripts/e2e_tests.ts` to import resource utility
- [x] 4.2 Add step to extract reporter to temp directory after services start
- [x] 4.3 Copy extracted reporter to container before running tests
- [x] 4.4 Add error handling for copy failure

## 5. Validation

- [x] 5.1 Run `bun run generate:manifest` and verify resources in manifest
- [x] 5.2 Test in development mode with `af e2e`
- [x] 5.3 Test compiled binary functionality
