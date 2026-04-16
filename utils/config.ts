import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { FieldSchemaType } from '../jira/lib/fields/codec-types.ts';

/**
 * Configuration for the stop-hook command.
 */
export interface StopHookConfig {
    ignoredPaths: string[];
    command: string;
}

export interface JiraCustomFieldAlias {
    id: string;
    type?: FieldSchemaType;
}

export interface JiraConfig {
    customFields?: Record<string, JiraCustomFieldAlias>;
}

/**
 * Full af.json configuration structure.
 */
export interface AfConfig {
    stopHook?: Partial<StopHookConfig>;
    jira?: JiraConfig;
}

const CUSTOMFIELD_ID_PATTERN = /^customfield_\d+$/;
const VALID_SCHEMA_TYPES: ReadonlySet<FieldSchemaType> = new Set<FieldSchemaType>([
    'number',
    'string',
    'date',
    'datetime',
    'option',
    'option-array',
    'user',
    'user-array',
    'version',
    'version-array',
    'sprint',
    'epic-link',
    'unknown',
]);

/**
 * Default configuration values.
 */
const DEFAULT_STOP_HOOK_CONFIG: StopHookConfig = {
    ignoredPaths: ['openspec/'],
    command: 'af e2e',
};

/**
 * Load configuration from af.json in the current working directory.
 * Returns undefined if the file doesn't exist.
 * Throws if the file exists but is invalid JSON.
 */
export function loadAfConfig(): AfConfig | undefined {
    const configPath = join(process.cwd(), 'af.json');

    if (!existsSync(configPath)) {
        return undefined;
    }

    const content = readFileSync(configPath, 'utf-8');
    return JSON.parse(content) as AfConfig;
}

/**
 * Get the stop-hook configuration, merging af.json settings with defaults.
 * If ignoredPaths is specified in af.json, it completely replaces the defaults.
 */
export function getStopHookConfig(): StopHookConfig {
    const afConfig = loadAfConfig();

    if (!afConfig?.stopHook) {
        return DEFAULT_STOP_HOOK_CONFIG;
    }

    return {
        ignoredPaths: afConfig.stopHook.ignoredPaths ?? DEFAULT_STOP_HOOK_CONFIG.ignoredPaths,
        command: afConfig.stopHook.command ?? DEFAULT_STOP_HOOK_CONFIG.command,
    };
}

/**
 * Read and validate the `jira.customFields` map from af.json.
 * Returns an empty object when no config or no section is present.
 * Throws when an entry is malformed (missing id, bad id format, unknown type).
 */
export function getJiraCustomFieldAliases(): Record<string, JiraCustomFieldAlias> {
    const afConfig = loadAfConfig();
    const raw = afConfig?.jira?.customFields;
    if (!raw) {
        return {};
    }

    const validated: Record<string, JiraCustomFieldAlias> = {};
    for (const [alias, entry] of Object.entries(raw)) {
        if (!entry || typeof entry !== 'object') {
            throw new Error(`jira.customFields["${alias}"]: expected an object`);
        }
        const id = (entry as JiraCustomFieldAlias).id;
        if (typeof id !== 'string' || !CUSTOMFIELD_ID_PATTERN.test(id)) {
            throw new Error(
                `jira.customFields["${alias}"].id: expected "customfield_<digits>", got ${JSON.stringify(id)}`,
            );
        }
        const type = (entry as JiraCustomFieldAlias).type;
        if (type !== undefined && !VALID_SCHEMA_TYPES.has(type)) {
            throw new Error(
                `jira.customFields["${alias}"].type: unknown schema type ${JSON.stringify(type)}`,
            );
        }
        validated[alias] = type ? { id, type } : { id };
    }
    return validated;
}
