/**
 * Gets the configured agent command name from the ARTIFEX_AGENT environment variable.
 * Falls back to 'claude' if not set.
 *
 * @returns The agent command name to use
 */
export function getAgentCommand(): string {
    return process.env.ARTIFEX_AGENT || 'claude';
}
