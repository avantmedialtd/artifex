# Proposal: Add 'zap' CLI Executable

## Why
Currently, there is no way to execute the zap utility from the command line. Users need a simple, intuitive command (`zap`) to access the tool's functionality. This is the foundational capability needed before any CLI features can be used.

By using vanilla Node.js without build tools or transpilation, we maintain the project's zero-config goal and minimal dependency philosophy while providing immediate execution capability.

## What Changes
This change introduces:
1. **CLI Executable capability** - A new `zap` executable file that can be run directly from the command line
2. Proper shebang configuration for Node.js execution
3. Package.json `bin` configuration to enable npm linking and installation
4. Direct TypeScript execution without build step

## Impact
**User Experience:**
- Developers can run `npm link` and immediately use the `zap` command
- No build step or transpilation required
- Simple, intuitive command-line interface

**Technical:**
- Adds one executable file to the repository
- Updates package.json with `bin` field
- Requires Node.js with TypeScript support (experimental flags or loader)

**Migration:**
- No breaking changes (net-new capability)
- No existing code to migrate

## Approach
Create an executable `zap` file (no extension) with a Node.js shebang that:
- Uses `#!/usr/bin/env node --experimental-strip-types` to execute TypeScript directly
- Loads and executes main.ts
- Can be symlinked via `npm link` for local development
- Requires Node.js 22.6+ (user has v24.10.0)

**Decisions made:**
- ✅ Use `#!/usr/bin/env node --experimental-strip-types` for direct TypeScript execution
- ✅ Name the executable `zap` (no extension) following CLI conventions
- ✅ Include Windows compatibility (npm will auto-generate .cmd wrapper)

Alternative approaches considered:
- **Build step with TypeScript compilation**: Rejected to maintain zero-config goal
- **ts-node dependency**: Rejected to minimize dependencies and use vanilla Node.js
- **Deno or Bun**: Rejected to maintain Node.js compatibility as specified in project.md
- **Wrapper script approach**: Rejected in favor of direct --experimental-strip-types flag

## Dependencies
None (first OpenSpec change for this project)

## Related Changes
None

## Open Questions
None (all questions resolved)
