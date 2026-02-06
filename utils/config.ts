import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Configuration for the stop-hook command.
 */
export interface StopHookConfig {
    ignoredPaths: string[];
    command: string;
}

/**
 * Full af.json configuration structure.
 */
export interface AfConfig {
    stopHook?: Partial<StopHookConfig>;
}

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
