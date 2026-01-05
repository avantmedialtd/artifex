# Copy Reporter to Container Before E2E Tests

## Why

The E2E test script references `./copy-prompt-reporter.ts` inside the Docker container but never copies the file there. Additionally, when `af` is compiled into a single executable, the reporter file must be embedded and extractable at runtime.

## What Changes

- Move `copy-prompt-reporter.ts` to `resources/` directory for bundling
- Update manifest generator to include resource files
- Create utility to extract embedded resources (works in both dev and compiled modes)
- Update E2E test script to extract reporter and copy it to container before running tests

## Impact

- Affected specs: `e2e-command`
- Affected code:
  - `resources/copy-prompt-reporter.ts` (new location)
  - `scripts/generate-setup-manifest.ts`
  - `generated/setup-manifest.ts`
  - `utils/resources.ts` (new file)
  - `scripts/e2e_tests.ts`
