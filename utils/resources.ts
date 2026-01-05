/**
 * Resource file utilities for extracting bundled resource files.
 * Handles both development mode (files on disk) and compiled mode (embedded in binary).
 */

import { mkdirSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { RESOURCE_FILES, isCompiled, type ResourceFile } from '../generated/setup-manifest.ts';

/**
 * Get the project root directory where resources/ folder is located.
 * In development mode, this is relative to this source file.
 * In compiled mode, files are embedded and this isn't used.
 */
function getProjectRoot(): string {
    // import.meta.dirname gives us the directory of this file (utils/)
    // We need to go up one level to get to the project root
    return dirname(import.meta.dirname);
}

/**
 * Get a resource file entry by name.
 */
export function getResource(name: string): ResourceFile | undefined {
    return RESOURCE_FILES.find(r => r.name === name);
}

/**
 * Extract a resource file to a target path.
 * Works in both development mode (copies from disk) and compiled mode (extracts from binary).
 *
 * @param name - The resource file name (e.g., "copy-prompt-reporter.ts")
 * @param targetPath - The absolute path to write the file to
 * @throws Error if the resource is not found
 */
export async function extractResource(name: string, targetPath: string): Promise<void> {
    const resource = getResource(name);
    if (!resource) {
        throw new Error(`Resource not found: ${name}`);
    }

    // Ensure target directory exists
    mkdirSync(dirname(targetPath), { recursive: true });

    if (isCompiled()) {
        // In compiled mode, use Bun.file() to read from $bunfs virtual filesystem
        const content = await Bun.file(resource.embeddedPath).bytes();
        writeFileSync(targetPath, content);
    } else {
        // In development mode, copy from source directory relative to project root
        const sourcePath = join(getProjectRoot(), 'resources', resource.name);
        copyFileSync(sourcePath, targetPath);
    }
}

/**
 * List all available resource files.
 */
export function listResources(): string[] {
    return RESOURCE_FILES.map(r => r.name);
}

// Re-export for convenience
export { isCompiled };
