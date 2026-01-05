import { spawn } from 'node:child_process';
import path from 'node:path';

/**
 * Handle the 'e2e' command.
 * Spawns the e2e_tests.ts script with any provided arguments.
 *
 * @param args - Arguments to pass through to the test runner
 * @returns Exit code from the test runner
 */
export async function handleE2e(args: string[]): Promise<number> {
    const scriptPath = path.resolve(import.meta.dir, '..', 'scripts', 'e2e_tests.ts');

    return new Promise(resolve => {
        const child = spawn('bun', [scriptPath, ...args], {
            stdio: 'inherit',
            cwd: process.cwd(),
        });

        child.on('error', err => {
            console.error(`Failed to start e2e tests: ${err.message}`);
            resolve(1);
        });

        child.on('close', code => {
            resolve(code ?? 0);
        });
    });
}
