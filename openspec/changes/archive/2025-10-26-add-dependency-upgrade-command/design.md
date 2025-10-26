# Design: Dependency Upgrade Command

## Architecture Overview

The `zap npm upgrade` command will follow a simple workflow leveraging npm's built-in commands:

1. **Run** `npm outdated` to identify packages with newer versions available
2. **Install** each outdated package using `npm install <package>@latest`

This approach delegates all complexity to npm itself:

- npm handles version resolution and registry queries
- npm updates package.json automatically with appropriate version ranges
- npm updates package-lock.json automatically
- npm handles all network failures and error cases

## Implementation Approach

### Command Structure

- Parse process.argv to detect `npm` subcommand and `upgrade` sub-subcommand
- Execute the upgrade workflow when command is recognized
- Display helpful error for unknown subcommands

### Discovering Outdated Packages

- Execute `npm outdated --json` via child_process
- Parse JSON output to get list of packages with available updates
- Handle case where no packages need updating (empty result)

### Upgrading Packages

- For each outdated package, execute `npm install <package>@latest`
- Run installations sequentially to ensure clear output and avoid conflicts
- Stream npm output to console so user sees progress
- Continue with remaining packages if one fails (report errors but don't abort)

### Error Handling

- Check if package.json exists (npm outdated will fail gracefully if not)
- Handle npm command failures with clear error messages
- Report which packages failed to upgrade and why
- Exit with non-zero code if any critical errors occur

### Output Design

- Display message when starting upgrade process
- Show npm outdated output or summary of packages being upgraded
- Stream each npm install command output
- Display final summary of successes and failures

## Trade-offs

### Why use npm commands instead of manual package.json updates?

**Decision**: Use `npm outdated` and `npm install package@latest` instead of manually parsing and updating package.json.

**Rationale**:

- Simpler implementation - let npm handle all the complexity
- npm automatically preserves version range conventions (^, ~)
- npm handles package-lock.json updates correctly
- npm provides better error messages for network/registry issues
- Less code to maintain and test
- Consistent behavior with what developers expect from npm

**Alternative considered**: Manually parse package.json, query registry, update versions. Rejected because it duplicates npm's functionality and is more error-prone.

### Why upgrade packages sequentially?

**Decision**: Run `npm install package@latest` sequentially for each package rather than all at once.

**Rationale**:

- Clearer output - user can see which package is being installed
- Better error isolation - one failing package doesn't block others
- Easier to report which specific packages succeeded or failed
- Avoids potential npm concurrency issues

**Alternative considered**: Run one `npm install package1@latest package2@latest ...` command. Rejected because it makes error reporting less granular and output harder to follow.

### Why "npm upgrade" as the command structure?

**Decision**: Use `zap npm upgrade` as the command structure.

**Rationale**:

- Groups npm-related utilities under the `npm` namespace
- Clear and descriptive: immediately obvious it upgrades npm packages
- Consistent with potential future npm-related commands (e.g., `zap npm audit`, `zap npm clean`)
- Follows common CLI patterns where related commands are grouped

**Alternative considered**: `zap ready`, `zap upgrade-deps`. Rejected because `ready` is too vague and `upgrade-deps` doesn't indicate it's npm-specific.

## Dependencies

- Node.js built-in modules: `child_process` for executing npm commands
- npm CLI must be available in PATH (included with standard Node.js installation)
- No third-party dependencies required

## Testing Strategy

- Unit tests for parsing `npm outdated` JSON output
- Unit tests for command routing and argument parsing
- Integration tests with real npm commands on test projects
- Test error scenarios: missing package.json, network failures, invalid packages
- Mock npm command execution for unit tests to avoid network calls
- Manual testing with real projects that have outdated dependencies
