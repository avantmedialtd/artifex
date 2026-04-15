## 1. Update user-documentation spec

- [x] 1.1 Rewrite the "User installs from NPM" scenario — captured in `changes/fix-bun-prerequisite-docs/specs/user-documentation/spec.md` (MODIFIED delta, applied to main spec at archive)
- [x] 1.2 Rewrite the "User checks system requirements" scenario — captured in the same delta
- [x] 1.3 Extend the "Developer installs from source" scenario — captured in the same delta

## 2. Update README.md

- [x] 2.1 Update the "Prerequisites" section under "Installation" to list Node.js ≥16 as the runtime requirement and describe Bun as a bundled dependency (no separate install needed)
- [x] 2.2 Add a brief contributor note (in Installation or Development) clarifying that Bun must be installed locally when building from source or running tests
- [x] 2.3 Re-read the surrounding "Install from Source", "Platform Support", and "Development" sections to ensure the new wording is consistent with them

## 3. Verify

- [x] 3.1 Run `openspec validate fix-bun-prerequisite-docs --strict` and confirm it passes
- [x] 3.2 Confirm `npm-package-config` and `cli-executable` specs remain unchanged (no collateral edits)
- [x] 3.3 Spot-check the rendered README for formatting, link integrity, and consistent tone
