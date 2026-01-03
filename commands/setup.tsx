/**
 * Setup command handler.
 * Copies bundled configuration files to Claude and OpenCode directories.
 */

import { homedir } from 'node:os';
import { render } from '../utils/ink-render.tsx';
import { FileConflict } from '../components/file-conflict.tsx';
import {
    performSetup,
    listSetupFiles,
    getTargetDir,
    getOpenCodeDir,
    getSetupFileCount,
    getOpenCodeCommandCount,
    type ConflictResolution,
} from '../utils/setup-files.ts';
import { success, error, info, header, section, listItem, warn } from '../utils/output.ts';

/**
 * Prompt user for conflict resolution using interactive component.
 */
function promptConflict(targetPath: string): Promise<ConflictResolution> {
    return new Promise(resolve => {
        const { unmount } = render(
            <FileConflict
                filePath={targetPath}
                onResolve={resolution => {
                    unmount();
                    resolve(resolution);
                }}
            />,
        );
    });
}

/**
 * Format a path for display, replacing home directory with ~.
 */
function formatPath(path: string): string {
    const home = homedir();
    if (path.startsWith(home)) {
        return path.replace(home, '~');
    }
    return path;
}

/**
 * Handle the 'setup' command.
 * Copies configuration files to ~/.claude/ and ~/.config/opencode/.
 *
 * Options:
 *   --list, -l  List files that would be copied without copying
 *   --force, -f Overwrite all existing files without prompting
 *
 * @param args - Command arguments
 * @returns Exit code (0 for success, 1 for error)
 */
export async function handleSetup(args: string[]): Promise<number> {
    // Parse flags
    const forceFlag = args.includes('--force') || args.includes('-f');
    const listFlag = args.includes('--list') || args.includes('-l');

    const claudeDir = `${formatPath(getTargetDir())}/.claude`;
    const openCodeDir = formatPath(getOpenCodeDir());

    // List mode - show what would be copied
    if (listFlag) {
        header('Files to copy');
        console.log();
        info('Targets:');
        listItem(`Claude: ${claudeDir} (commands + skills)`);
        listItem(`OpenCode: ${openCodeDir} (commands only, skills shared)`);
        console.log();

        const files = listSetupFiles();

        section('Claude files');
        for (const { file, exists } of files) {
            const status = exists ? ' (exists)' : '';
            listItem(`${file.relativePath}${status}`);
        }

        // Show OpenCode command files
        const commandFiles = files.filter(f => f.openCodePath);
        if (commandFiles.length > 0) {
            console.log();
            section('OpenCode command files');
            for (const { openCodePath, openCodeExists } of commandFiles) {
                const status = openCodeExists ? ' (exists)' : '';
                listItem(`${formatPath(openCodePath!)}${status}`);
            }
        }

        const existingCount = files.filter(f => f.exists).length;
        const openCodeExisting = commandFiles.filter(f => f.openCodeExists).length;
        console.log();
        info(
            `${files.length} Claude files (${existingCount} exist), ` +
                `${commandFiles.length} OpenCode files (${openCodeExisting} exist)`,
        );

        return 0;
    }

    // Perform setup
    header('Setting up AI agent configurations');
    console.log();
    info('Targets:');
    listItem(`Claude: ${claudeDir}`);
    listItem(`OpenCode: ${openCodeDir} (commands only)`);
    console.log();
    info(`Files: ${getSetupFileCount()} Claude + ${getOpenCodeCommandCount()} OpenCode`);
    console.log();

    const result = await performSetup(async targetPath => {
        if (forceFlag) {
            return 'overwrite';
        }
        return promptConflict(targetPath);
    });

    // Report results
    if (result.copied.length > 0) {
        section('Copied files');
        for (const path of result.copied) {
            listItem(formatPath(path), '+');
        }
    }

    if (result.skipped.length > 0) {
        section('Skipped files');
        for (const path of result.skipped) {
            listItem(formatPath(path), '-');
        }
    }

    if (result.errors.length > 0) {
        section('Errors');
        for (const { path, error: err } of result.errors) {
            error(`  ${path}: ${err}`);
        }
        return 1;
    }

    console.log();
    if (result.copied.length > 0) {
        success(`Setup complete! ${result.copied.length} files copied.`);
    } else if (result.skipped.length > 0) {
        warn(`Setup complete. All ${result.skipped.length} files were skipped.`);
    } else {
        info('Nothing to do.');
    }

    return 0;
}
