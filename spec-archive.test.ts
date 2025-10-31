import { describe, it, expect } from 'vitest';
import { spawn } from 'child_process';

// Create a test helper to run zap commands
function runZap(args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    return new Promise(resolve => {
        const proc = spawn('node', ['main.ts', ...args]);
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

describe('zap spec archive', () => {
    describe('command validation', () => {
        it('should error when spec command has no subcommand', async () => {
            const result = await runZap(['spec']);

            expect(result.exitCode).toBe(1);
            expect(result.stderr).toContain('Error: spec command requires a subcommand');
        });

        it('should error when spec has unknown subcommand', async () => {
            const result = await runZap(['spec', 'unknown']);

            expect(result.exitCode).toBe(1);
            expect(result.stderr).toContain('Error: Unknown spec subcommand: unknown');
        });

        it('should error when spec archive has no spec-id', async () => {
            const result = await runZap(['spec', 'archive']);

            expect(result.exitCode).toBe(1);
            expect(result.stderr).toContain('Error: spec archive requires a spec-id argument');
            expect(result.stderr).toContain('Usage: zap spec archive <spec-id>');
        });
    });

    describe('Claude Code integration', () => {
        it.skip('should attempt to check for claude availability', async () => {
            // Skip this test because if Claude Code is installed, it will run interactively
            // and hang the test. This is tested in the integration test instead.
            expect(true).toBe(true);
        });
    });
});

describe('zap archive (shorthand)', () => {
    describe('command validation', () => {
        it('should error when archive has no spec-id', async () => {
            const result = await runZap(['archive']);

            expect(result.exitCode).toBe(1);
            expect(result.stderr).toContain('Error: spec archive requires a spec-id argument');
            expect(result.stderr).toContain('Usage: zap spec archive <spec-id>');
        });
    });

    describe('Claude Code integration', () => {
        it.skip('should invoke Claude Code with correct flags when spec-id is provided', async () => {
            // Skip this test because if Claude Code is installed, it will run interactively
            // and hang the test. This is tested in the integration test instead.
            expect(true).toBe(true);
        });
    });
});

// Note: More detailed unit tests with mocks could be added here in the future
// if we need to verify the exact command construction without spawning processes.
// For now, the command validation tests above cover the main error cases,
// and manual testing confirms the full execution flow works correctly.
//
// Auto-commit functionality:
// - The git utility functions (stageAndCommit, stageDirectory, createCommit) are unit tested in utils/git.test.ts
// - The proposal title extraction is tested in utils/proposal.test.ts
// - The integration of these utilities in handleSpecArchive is verified through manual testing
// - Auto-commit behavior matches the existing pattern used in handleSpecPropose
