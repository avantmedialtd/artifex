import { spawn } from 'node:child_process';

/**
 * Checks if Claude Code CLI is available in the system PATH.
 * Uses `claude --version` to verify the executable exists and is working.
 *
 * @returns Promise that resolves to true if Claude Code is available, false otherwise
 */
export async function checkClaudeAvailable(): Promise<boolean> {
    return new Promise(resolve => {
        const checkProcess = spawn('claude', ['--version'], {
            stdio: 'ignore', // Suppress output
        });

        // Add timeout to prevent hanging
        const timeout = setTimeout(() => {
            checkProcess.kill();
            resolve(false);
        }, 3000); // 3 second timeout

        checkProcess.on('close', code => {
            clearTimeout(timeout);
            resolve(code === 0);
        });

        checkProcess.on('error', () => {
            clearTimeout(timeout);
            resolve(false);
        });
    });
}
