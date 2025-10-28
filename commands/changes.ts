import { spawn } from 'node:child_process';
import { error } from '../utils/output.ts';

/**
 * Check if the openspec command is available in PATH.
 * @returns Promise that resolves to true if available, false otherwise
 */
async function checkOpenSpecAvailable(): Promise<boolean> {
    return new Promise(resolve => {
        const which = spawn('which', ['openspec'], {
            stdio: 'ignore',
        });

        which.on('close', code => {
            resolve(code === 0);
        });

        which.on('error', () => {
            resolve(false);
        });
    });
}

/**
 * Handle the 'changes' command.
 * Lists all OpenSpec changes by executing 'openspec list --changes'.
 *
 * @param hasArgs - Whether any arguments were provided to the command
 * @returns Exit code (0 for success, 1 for error)
 */
export async function handleChanges(hasArgs: boolean): Promise<number> {
    // Reject if arguments were provided
    if (hasArgs) {
        error('Error: changes command does not accept arguments');
        console.error('Usage: zap changes');
        return 1;
    }

    // Check if openspec is available
    const isOpenSpecAvailable = await checkOpenSpecAvailable();
    if (!isOpenSpecAvailable) {
        error('Error: openspec command is not installed or not in PATH');
        console.error('Please install OpenSpec CLI to use this command.');
        return 1;
    }

    // Execute openspec list --changes
    const openspecProcess = spawn('openspec', ['list', '--changes'], {
        stdio: 'inherit', // Pipe stdout, stderr, and stdin to parent process
    });

    // Wait for the process to complete and return its status code
    return new Promise(resolve => {
        openspecProcess.on('close', code => {
            resolve(code ?? 1);
        });

        openspecProcess.on('error', err => {
            error(`Error executing openspec command: ${err.message}`);
            resolve(1);
        });
    });
}
