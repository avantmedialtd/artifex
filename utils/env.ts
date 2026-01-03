import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Load environment variables from a .env file in the current working directory.
 * Silently skips if the file doesn't exist - never fails.
 *
 * Features:
 * - Parses KEY=value pairs
 * - Handles quoted values (single and double quotes)
 * - Ignores comments (lines starting with #)
 * - Ignores empty lines
 * - Does not overwrite existing environment variables
 */
export function loadEnv(): void {
    const envPath = join(process.cwd(), '.env');

    if (!existsSync(envPath)) {
        return; // Silently skip if .env doesn't exist
    }

    const content = readFileSync(envPath, 'utf-8');

    for (const line of content.split('\n')) {
        const trimmed = line.trim();

        // Skip empty lines and comments
        if (!trimmed || trimmed.startsWith('#')) {
            continue;
        }

        const eqIndex = trimmed.indexOf('=');
        if (eqIndex === -1) {
            continue;
        }

        const key = trimmed.slice(0, eqIndex).trim();
        let value = trimmed.slice(eqIndex + 1).trim();

        // Remove surrounding quotes if present
        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }

        // Don't overwrite existing environment variables
        if (process.env[key] === undefined) {
            process.env[key] = value;
        }
    }
}
