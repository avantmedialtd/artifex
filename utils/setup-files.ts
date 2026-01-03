/**
 * Setup file utilities for copying bundled configuration files.
 * Handles both development mode (files on disk) and compiled mode (embedded in binary).
 */

import { existsSync, mkdirSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { SETUP_FILES, isCompiled, type SetupFile } from '../generated/setup-manifest.ts';

export type ConflictResolution = 'overwrite' | 'skip' | 'overwrite-all' | 'skip-all';

export interface SetupResult {
    copied: string[];
    skipped: string[];
    errors: Array<{ path: string; error: string }>;
}

export interface FileInfo {
    file: SetupFile;
    targetPath: string;
    exists: boolean;
    /** OpenCode target path for command files (null for skills) */
    openCodePath?: string;
    openCodeExists?: boolean;
}

/**
 * Get the Claude target directory (user's home directory).
 */
export function getTargetDir(): string {
    return homedir();
}

/**
 * Get the OpenCode config directory.
 */
export function getOpenCodeDir(): string {
    return join(homedir(), '.config', 'opencode');
}

/**
 * Check if a file is a command file (not a skill).
 */
function isCommandFile(relativePath: string): boolean {
    return relativePath.includes('.claude/commands/');
}

/**
 * Get OpenCode target path for a Claude command file.
 * Returns null for non-command files (skills are shared via ~/.claude/skills/).
 */
export function getOpenCodeCommandPath(claudePath: string): string | null {
    // Only transform command files
    if (!claudePath.includes('/commands/')) return null;

    // ~/.claude/commands/foo.md → ~/.config/opencode/command/foo.md
    return claudePath
        .replace(join(homedir(), '.claude'), join(homedir(), '.config', 'opencode'))
        .replace('/commands/', '/command/');
}

/**
 * List all files that would be copied, with conflict info.
 * Includes OpenCode target paths for command files.
 */
export function listSetupFiles(): FileInfo[] {
    const targetDir = getTargetDir();

    return SETUP_FILES.map(file => {
        const targetPath = join(targetDir, file.relativePath);
        const openCodePath = isCommandFile(file.relativePath)
            ? getOpenCodeCommandPath(targetPath)
            : undefined;

        return {
            file,
            targetPath,
            exists: existsSync(targetPath),
            openCodePath: openCodePath ?? undefined,
            openCodeExists: openCodePath ? existsSync(openCodePath) : undefined,
        };
    });
}

/**
 * Get the project root directory where setup/ folder is located.
 * In development mode, this is relative to this source file.
 * In compiled mode, files are embedded and this isn't used.
 */
function getProjectRoot(): string {
    // import.meta.dirname gives us the directory of this file (utils/)
    // We need to go up one level to get to the project root
    return dirname(import.meta.dirname);
}

/**
 * Copy a single file from embedded source to target.
 */
export async function copySetupFile(file: SetupFile, targetPath: string): Promise<void> {
    // Ensure target directory exists
    mkdirSync(dirname(targetPath), { recursive: true });

    if (isCompiled()) {
        // In compiled mode, use Bun.file() to read from $bunfs virtual filesystem
        const content = await Bun.file(file.embeddedPath).bytes();
        writeFileSync(targetPath, content);
    } else {
        // In development mode, copy from source directory relative to project root
        const sourcePath = join(getProjectRoot(), 'setup', file.relativePath);
        copyFileSync(sourcePath, targetPath);
    }
}

/**
 * Perform the full setup operation.
 * Copies files to both Claude and OpenCode directories.
 * @param resolveConflict - Callback for conflict resolution
 */
export async function performSetup(
    resolveConflict: (targetPath: string) => Promise<ConflictResolution>,
): Promise<SetupResult> {
    const result: SetupResult = {
        copied: [],
        skipped: [],
        errors: [],
    };

    let skipAll = false;
    let overwriteAll = false;

    const files = listSetupFiles();

    for (const { file, targetPath, exists, openCodePath, openCodeExists } of files) {
        // Handle Claude target
        try {
            if (exists && !overwriteAll && !skipAll) {
                const resolution = await resolveConflict(targetPath);

                if (resolution === 'skip-all') {
                    skipAll = true;
                    result.skipped.push(targetPath);
                    // Also skip OpenCode path
                    if (openCodePath) {
                        result.skipped.push(openCodePath);
                    }
                    continue;
                }
                if (resolution === 'overwrite-all') {
                    overwriteAll = true;
                }
                if (resolution === 'skip') {
                    result.skipped.push(targetPath);
                    // Also skip OpenCode path
                    if (openCodePath) {
                        result.skipped.push(openCodePath);
                    }
                    continue;
                }
            } else if (exists && skipAll) {
                result.skipped.push(targetPath);
                if (openCodePath) {
                    result.skipped.push(openCodePath);
                }
                continue;
            }

            await copySetupFile(file, targetPath);
            result.copied.push(targetPath);
        } catch (err) {
            result.errors.push({
                path: targetPath,
                error: err instanceof Error ? err.message : String(err),
            });
        }

        // Handle OpenCode target (commands only)
        if (openCodePath) {
            try {
                // Check for conflict on OpenCode path separately
                if (openCodeExists && !overwriteAll && !skipAll) {
                    const resolution = await resolveConflict(openCodePath);

                    if (resolution === 'skip-all') {
                        skipAll = true;
                        result.skipped.push(openCodePath);
                        continue;
                    }
                    if (resolution === 'overwrite-all') {
                        overwriteAll = true;
                    }
                    if (resolution === 'skip') {
                        result.skipped.push(openCodePath);
                        continue;
                    }
                } else if (openCodeExists && skipAll) {
                    result.skipped.push(openCodePath);
                    continue;
                }

                await copySetupFile(file, openCodePath);
                result.copied.push(openCodePath);
            } catch (err) {
                result.errors.push({
                    path: openCodePath,
                    error: err instanceof Error ? err.message : String(err),
                });
            }
        }
    }

    return result;
}

/**
 * Get count of setup files for display purposes.
 */
export function getSetupFileCount(): number {
    return SETUP_FILES.length;
}

// Re-export for convenience
export { isCompiled };

/**
 * Get the count of OpenCode command files for display purposes.
 */
export function getOpenCodeCommandCount(): number {
    return SETUP_FILES.filter(f => isCommandFile(f.relativePath)).length;
}
