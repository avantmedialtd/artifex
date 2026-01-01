# Tasks

## Implementation

- [x] Update `af` executable shebang from `#!/usr/bin/env -S npx tsx` to `#!/usr/bin/env bun`
- [x] Update `zap` executable shebang from `#!/usr/bin/env -S npx tsx` to `#!/usr/bin/env bun`
- [x] Remove tsx from devDependencies in package.json
- [x] Update `openspec/project.md` to document Bun as the runtime

## Documentation

- [x] Update `CLAUDE.md` to reflect Bun runtime usage
- [x] Update any references to tsx in documentation

## Validation

- [x] Verify `af help` works correctly with Bun
- [x] Verify `af spec propose` works correctly
- [x] Verify `af spec archive` works correctly
- [x] Verify all npm scripts still work (lint, format, test, spell:check)
- [x] Run full test suite: `npm test`
