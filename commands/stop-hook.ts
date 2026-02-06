import { spawnSync } from 'node:child_process';
import { getStopHookConfig } from '../utils/config.ts';
import { info } from '../utils/output.ts';

/**
 * Get changed files from git.
 * Combines staged, unstaged, and untracked files.
 */
function getChangedFiles(): string[] {
    const files = new Set<string>();

    // Staged changes
    const staged = spawnSync('git', ['diff', '--name-only', '--cached'], {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
    });
    if (staged.status === 0 && staged.stdout) {
        for (const file of staged.stdout.trim().split('\n')) {
            if (file) files.add(file);
        }
    }

    // Unstaged changes
    const unstaged = spawnSync('git', ['diff', '--name-only'], {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
    });
    if (unstaged.status === 0 && unstaged.stdout) {
        for (const file of unstaged.stdout.trim().split('\n')) {
            if (file) files.add(file);
        }
    }

    // Untracked files
    const untracked = spawnSync('git', ['ls-files', '--others', '--exclude-standard'], {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
    });
    if (untracked.status === 0 && untracked.stdout) {
        for (const file of untracked.stdout.trim().split('\n')) {
            if (file) files.add(file);
        }
    }

    return Array.from(files);
}

/**
 * Filter out files that match any of the ignored path prefixes.
 */
function filterIgnoredPaths(files: string[], ignoredPaths: string[]): string[] {
    return files.filter(file => !ignoredPaths.some(prefix => file.startsWith(prefix)));
}

/**
 * Handle the 'stop-hook' command.
 * Conditionally runs e2e tests based on changed files.
 *
 * @returns Exit code: 0 (success/skipped), 2 (e2e failed)
 */
export async function handleStopHook(): Promise<number> {
    const config = getStopHookConfig();

    const changedFiles = getChangedFiles();
    const relevantFiles = filterIgnoredPaths(changedFiles, config.ignoredPaths);

    if (relevantFiles.length === 0) {
        info('No relevant file changes detected, skipping e2e tests');
        return 0;
    }

    info(`Running e2e tests (${relevantFiles.length} relevant file(s) changed)`);
    console.log(relevantFiles.join('\n'));

    // Parse the command into parts
    const parts = config.command.split(/\s+/);
    const cmd = parts[0];
    const args = parts.slice(1);

    const result = spawnSync(cmd, args, {
        stdio: 'inherit',
        shell: true,
    });

    if (result.status !== 0) {
        return 2;
    }

    return 0;
}
