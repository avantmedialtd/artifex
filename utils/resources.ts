/**
 * Resource file utilities for copying bundled resource files.
 */

import { mkdirSync, copyFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * Get the project root directory where resources/ folder is located.
 */
function getProjectRoot(): string {
    // import.meta.dirname gives us the directory of this file (utils/)
    return dirname(import.meta.dirname);
}

function getResourcesDir(): string {
    return join(getProjectRoot(), 'resources');
}

/**
 * Copy a resource file to a target path.
 *
 * @param name - The resource file name (e.g., "copy-prompt-reporter.ts")
 * @param targetPath - The absolute path to write the file to
 * @throws Error if the resource is not found
 */
export async function extractResource(name: string, targetPath: string): Promise<void> {
    const sourcePath = join(getResourcesDir(), name);
    mkdirSync(dirname(targetPath), { recursive: true });
    copyFileSync(sourcePath, targetPath);
}

/**
 * List all available resource files.
 */
export function listResources(): string[] {
    return readdirSync(getResourcesDir());
}
