import { describe, it, expect } from 'vitest';
import { spawn } from 'child_process';

// Create a test helper to run zap commands
function runZap(args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    return new Promise(resolve => {
        const proc = spawn('bun', ['main.ts', ...args]);
        let stdout = '';
        let stderr = '';

        proc.stdout?.on('data', data => {
            stdout += data.toString();
        });

        proc.stderr?.on('data', data => {
            stderr += data.toString();
        });

        proc.on('close', exitCode => {
            resolve({ exitCode: exitCode ?? 1, stdout, stderr });
        });
    });
}

describe('af commit apply', () => {
    describe('command validation', () => {
        it('should error when commit has unknown subcommand', async () => {
            const result = await runZap(['commit', 'unknown']);

            expect(result.exitCode).toBe(1);
            expect(result.stderr).toContain('Error: Unknown commit subcommand: unknown');
        });
    });

    describe('help content', () => {
        it('should show commit help', async () => {
            const result = await runZap(['help', 'commit']);

            expect(result.exitCode).toBe(0);
            expect(result.stdout).toContain('af commit');
            expect(result.stdout).toContain('Commit changes with message and optional trailers');
        });
    });
});

describe('af commit (shorthand)', () => {
    describe('help content', () => {
        it('should show commit in general help', async () => {
            const result = await runZap(['help']);

            expect(result.exitCode).toBe(0);
            expect(result.stdout).toContain('commit');
            expect(result.stdout).toContain('Apply: <title>');
        });
    });
});

// Note: Full integration tests with actual git commits would require
// setting up a mock git repository, similar to utils/git.test.ts.
// The command routing and basic validation are tested above.
