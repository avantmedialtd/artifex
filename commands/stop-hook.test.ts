import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';

// Mock modules before importing the module under test
vi.mock('node:child_process', () => ({
    spawnSync: vi.fn(),
}));

vi.mock('../utils/config.ts', () => ({
    getStopHookConfig: vi.fn(),
}));

vi.mock('../utils/output.ts', () => ({
    info: vi.fn(),
}));

// Import after mocking
import { handleStopHook } from './stop-hook.ts';
import { getStopHookConfig } from '../utils/config.ts';

describe('stop-hook command', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getStopHookConfig).mockReturnValue({
            ignoredPaths: ['openspec/'],
            command: 'af e2e',
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    function mockGitDiff(staged: string[], unstaged: string[], untracked: string[] = []) {
        vi.mocked(spawnSync).mockImplementation((cmd, args) => {
            if (cmd === 'git') {
                if (args?.[0] === 'diff') {
                    if (args.includes('--cached')) {
                        return {
                            status: 0,
                            stdout: staged.join('\n'),
                        } as SpawnSyncReturns<string>;
                    }
                    // Unstaged
                    return {
                        status: 0,
                        stdout: unstaged.join('\n'),
                    } as SpawnSyncReturns<string>;
                }
                if (args?.[0] === 'ls-files') {
                    return {
                        status: 0,
                        stdout: untracked.join('\n'),
                    } as SpawnSyncReturns<string>;
                }
            }
            // For running the e2e command
            return { status: 0 } as SpawnSyncReturns<string>;
        });
    }

    describe('file change detection', () => {
        it('should skip e2e when no files changed', async () => {
            mockGitDiff([], []);

            const result = await handleStopHook();

            expect(result).toBe(0);
            // Should not have called the e2e command
            expect(spawnSync).not.toHaveBeenCalledWith('af', ['e2e'], expect.anything());
        });

        it('should skip e2e when only ignored paths changed', async () => {
            mockGitDiff(['openspec/project.md'], ['openspec/changes/test/proposal.md']);

            const result = await handleStopHook();

            expect(result).toBe(0);
        });

        it('should run e2e when source files changed', async () => {
            mockGitDiff(['src/index.ts'], []);

            const result = await handleStopHook();

            expect(result).toBe(0);
            // Should have called the e2e command
            expect(spawnSync).toHaveBeenCalledWith('af', ['e2e'], expect.anything());
        });

        it('should run e2e when mix of ignored and source files changed', async () => {
            mockGitDiff(['openspec/proposal.md', 'src/app.ts'], []);

            const result = await handleStopHook();

            expect(result).toBe(0);
            expect(spawnSync).toHaveBeenCalledWith('af', ['e2e'], expect.anything());
        });

        it('should combine files from staged, unstaged, and untracked sources', async () => {
            mockGitDiff(['src/a.ts'], ['src/b.ts'], ['src/c.ts']);

            const result = await handleStopHook();

            expect(result).toBe(0);
            expect(spawnSync).toHaveBeenCalledWith('af', ['e2e'], expect.anything());
        });

        it('should run e2e when only untracked files exist', async () => {
            mockGitDiff([], [], ['src/new-file.ts']);

            const result = await handleStopHook();

            expect(result).toBe(0);
            expect(spawnSync).toHaveBeenCalledWith('af', ['e2e'], expect.anything());
        });

        it('should deduplicate files across git sources', async () => {
            mockGitDiff(['src/same.ts'], ['src/same.ts'], ['src/same.ts']);

            const result = await handleStopHook();

            expect(result).toBe(0);
            expect(spawnSync).toHaveBeenCalledWith('af', ['e2e'], expect.anything());
        });
    });

    describe('custom configuration', () => {
        it('should use custom ignored paths from config', async () => {
            vi.mocked(getStopHookConfig).mockReturnValue({
                ignoredPaths: ['docs/', 'scripts/'],
                command: 'af e2e',
            });
            mockGitDiff(['docs/readme.md', 'scripts/build.sh'], []);

            const result = await handleStopHook();

            expect(result).toBe(0);
            // Files are in ignored paths, so e2e should not run
            expect(spawnSync).not.toHaveBeenCalledWith('af', ['e2e'], expect.anything());
        });

        it('should use custom command from config', async () => {
            vi.mocked(getStopHookConfig).mockReturnValue({
                ignoredPaths: ['openspec/'],
                command: 'npm run test:e2e',
            });
            mockGitDiff(['src/index.ts'], []);

            await handleStopHook();

            expect(spawnSync).toHaveBeenCalledWith('npm', ['run', 'test:e2e'], expect.anything());
        });
    });

    describe('exit codes', () => {
        it('should return 0 when e2e passes', async () => {
            mockGitDiff(['src/index.ts'], []);

            const result = await handleStopHook();

            expect(result).toBe(0);
        });

        it('should return 2 when e2e fails', async () => {
            vi.mocked(spawnSync).mockImplementation((cmd, args) => {
                if (cmd === 'git') {
                    if (args?.includes('--cached')) {
                        return { status: 0, stdout: 'src/index.ts' } as SpawnSyncReturns<string>;
                    }
                    return { status: 0, stdout: '' } as SpawnSyncReturns<string>;
                }
                // e2e command fails
                return { status: 1 } as SpawnSyncReturns<string>;
            });

            const result = await handleStopHook();

            expect(result).toBe(2);
        });
    });
});
