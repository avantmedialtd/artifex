/**
 * Gets the configured agent command name from the ZAP_AGENT environment variable.
 * Falls back to 'claude' if not set.
 *
 * @returns The agent command name to use
 */
export function getAgentCommand(): string {
    return process.env.ZAP_AGENT || 'claude';
}
