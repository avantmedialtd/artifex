import { spawn } from 'node:child_process';

/**
 * Gets the configured agent command name from the ZAP_AGENT environment variable.
 * Falls back to 'claude' if not set.
 *
 * @returns The agent command name to use
 */
export function getAgentCommand(): string {
    return process.env.ZAP_AGENT || 'claude';
}

/**
 * Checks if Claude Code CLI is available in the system PATH.
 * Uses `claude --version` to verify the executable exists and is working.
 *
 * @returns Promise that resolves to true if Claude Code is available, false otherwise
 */
export async function checkClaudeAvailable(): Promise<boolean> {
    return new Promise(resolve => {
        const checkProcess = spawn(getAgentCommand(), ['--version'], {
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
