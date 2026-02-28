/**
 * Jira configuration module.
 *
 * Delegates to shared Atlassian config which supports both ATLASSIAN_*
 * and legacy JIRA_* environment variables.
 */

import { getAtlassianConfig, type AtlassianConfig } from '../../atlassian/lib/config.ts';

export type Config = AtlassianConfig;

/**
 * Get Jira configuration from environment variables.
 * Prefers ATLASSIAN_* variables, falls back to JIRA_* for backward compatibility.
 */
export function getConfig(): Config {
    return getAtlassianConfig();
}
