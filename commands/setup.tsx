/**
 * Setup command handler.
 * Copies bundled configuration files to the user's home directory.
 */

import { render } from '../utils/ink-render.tsx';
import { FileConflict } from '../components/file-conflict.tsx';
import {
    performSetup,
    listSetupFiles,
    getTargetDir,
    getSetupFileCount,
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
 * Handle the 'setup' command.
 * Copies configuration files from bundled setup/ folder to ~/.claude/.
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

    const targetDir = getTargetDir();
    const locationLabel = '~';

    // List mode - show what would be copied
    if (listFlag) {
        header('Files to copy');
        info(`Target: ${locationLabel}`);
        console.log();

        const files = listSetupFiles();

        for (const { file, exists } of files) {
            const status = exists ? ' (exists)' : '';
            listItem(`${file.relativePath}${status}`);
        }

        const existingCount = files.filter(f => f.exists).length;
        console.log();
        info(`${files.length} files total, ${existingCount} already exist`);

        return 0;
    }

    // Perform setup
    header('Setting up Claude configuration');
    info(`Target: ${locationLabel}`);
    info(`Files: ${getSetupFileCount()} configuration files`);
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
            listItem(path.replace(targetDir, locationLabel), '+');
        }
    }

    if (result.skipped.length > 0) {
        section('Skipped files');
        for (const path of result.skipped) {
            listItem(path.replace(targetDir, locationLabel), '-');
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
