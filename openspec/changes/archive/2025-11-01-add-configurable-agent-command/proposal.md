# Proposal: Add configurable agent command via ZAP_AGENT environment variable

## Problem

The zap CLI currently hardcodes the `claude` command when invoking the AI agent for spec-related operations (propose, archive, apply). This creates friction for:

1. **Development and testing**: Developers cannot easily test with alternative agent implementations or mock agents without modifying code
2. **Flexibility**: Teams using different AI agent tools (e.g., custom wrappers, different CLI names, alternative AI assistants) must fork the codebase
3. **CI/CD environments**: Different execution environments may have the agent command available under different names or paths

The hardcoded `'claude'` string appears in 4 locations:
- `utils/claude.ts` - availability check (1 occurrence)
- `commands/spec.ts` - propose, archive, and apply commands (3 occurrences)

## Proposed Solution

Introduce a `ZAP_AGENT` environment variable that allows users to specify the agent command name. Default to `'claude'` when not set to maintain backward compatibility.

**Key behaviors:**
- If `ZAP_AGENT` is set, use that value as the command name
- If `ZAP_AGENT` is not set, default to `'claude'`
- Apply consistently across availability checks and command execution
- Update error messages to reference "agent" or the configured command name dynamically

**Example usage:**
```bash
# Use default claude command
zap spec propose "add feature X"

# Use custom agent command
ZAP_AGENT=my-agent zap spec propose "add feature X"

# Use absolute path to agent
ZAP_AGENT=/usr/local/bin/custom-claude zap spec propose "add feature X"
```

## Impact

**Modified capabilities:**
- `cli-modular-structure` - Updates the shared Claude availability check utility to support configurable agent command

**Benefits:**
- Zero breaking changes - defaults to existing behavior
- Enables testing with mock agents
- Supports alternative agent implementations
- Requires no configuration files - simple environment variable

**Risks:**
- None identified - purely additive change with backward-compatible default

## Alternatives Considered

1. **Configuration file** - Rejected as too heavy for a single setting
2. **CLI flag** - Rejected as it would need to be passed to every spec command
3. **Rename to generic "agent"** - Rejected as it would break existing users
