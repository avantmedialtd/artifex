import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import {
    isGitRepository,
    getCurrentHeadCommit,
    listWorktrees,
    getWorktreeBranch,
    hasUncommittedChanges,
    pushWorktree,
    resetWorktree,
} from './git-worktree.js';

// Mock child_process module
vi.mock('child_process');

describe('git-worktree', () => {
    const mockExecSync = vi.mocked(execSync);

    beforeEach(() => {
        mockExecSync.mockReset();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('isGitRepository', () => {
        it('should return true when in a git repository', () => {
            mockExecSync.mockReturnValue('');

            const result = isGitRepository();

            expect(result).toBe(true);
            expect(mockExecSync).toHaveBeenCalledWith('git rev-parse --git-dir', {
                stdio: 'ignore',
            });
        });

        it('should return false when not in a git repository', () => {
            mockExecSync.mockImplementation(() => {
                throw new Error('not a git repository');
            });

            const result = isGitRepository();

            expect(result).toBe(false);
        });
    });

    describe('getCurrentHeadCommit', () => {
        it('should return the current HEAD commit hash', () => {
            const commitHash = 'abc123def456';
            mockExecSync.mockReturnValue(commitHash + '\n');

            const result = getCurrentHeadCommit();

            expect(result).toBe(commitHash);
            expect(mockExecSync).toHaveBeenCalledWith('git rev-parse HEAD', { encoding: 'utf-8' });
        });

        it('should throw error when git command fails', () => {
            mockExecSync.mockImplementation(() => {
                throw new Error('not in a git repository');
            });

            expect(() => getCurrentHeadCommit()).toThrow(
                'Failed to get current HEAD commit: not in a git repository',
            );
        });
    });

    describe('listWorktrees', () => {
        it('should parse worktrees from porcelain output', () => {
            const porcelainOutput = `worktree /path/to/main
HEAD abc123
branch refs/heads/master

worktree /path/to/v1
HEAD def456
branch refs/heads/v1

worktree /path/to/v2
HEAD ghi789
branch refs/heads/v2
`;
            mockExecSync.mockReturnValue(porcelainOutput);

            const result = listWorktrees();

            expect(result).toEqual([
                { path: '/path/to/main', branch: 'master' },
                { path: '/path/to/v1', branch: 'v1' },
                { path: '/path/to/v2', branch: 'v2' },
            ]);
            expect(mockExecSync).toHaveBeenCalledWith('git worktree list --porcelain', {
                encoding: 'utf-8',
            });
        });

        it('should handle single worktree', () => {
            const porcelainOutput = `worktree /path/to/main
HEAD abc123
branch refs/heads/master
`;
            mockExecSync.mockReturnValue(porcelainOutput);

            const result = listWorktrees();

            expect(result).toEqual([{ path: '/path/to/main', branch: 'master' }]);
        });

        it('should handle worktrees without trailing blank line', () => {
            const porcelainOutput = `worktree /path/to/main
HEAD abc123
branch refs/heads/master`;
            mockExecSync.mockReturnValue(porcelainOutput);

            const result = listWorktrees();

            expect(result).toEqual([{ path: '/path/to/main', branch: 'master' }]);
        });

        it('should throw error when git command fails', () => {
            mockExecSync.mockImplementation(() => {
                throw new Error('not in a git repository');
            });

            expect(() => listWorktrees()).toThrow(
                'Failed to list worktrees: not in a git repository',
            );
        });
    });

    describe('getWorktreeBranch', () => {
        it('should extract branch name from refs/heads/ prefix', () => {
            expect(getWorktreeBranch('refs/heads/main')).toBe('main');
            expect(getWorktreeBranch('refs/heads/v1')).toBe('v1');
            expect(getWorktreeBranch('refs/heads/feature/test')).toBe('feature/test');
        });

        it('should return branch as-is if not refs/heads/ format', () => {
            expect(getWorktreeBranch('main')).toBe('main');
            expect(getWorktreeBranch('v1')).toBe('v1');
        });
    });

    describe('hasUncommittedChanges', () => {
        it('should return true when worktree has uncommitted changes', () => {
            const statusOutput = ' M file1.txt\n?? file2.txt\n';
            mockExecSync.mockReturnValue(statusOutput);

            const result = hasUncommittedChanges('/path/to/worktree');

            expect(result).toBe(true);
            expect(mockExecSync).toHaveBeenCalledWith('git status --porcelain', {
                cwd: '/path/to/worktree',
                encoding: 'utf-8',
            });
        });

        it('should return false when worktree is clean', () => {
            mockExecSync.mockReturnValue('');

            const result = hasUncommittedChanges('/path/to/worktree');

            expect(result).toBe(false);
        });

        it('should return false when status output is only whitespace', () => {
            mockExecSync.mockReturnValue('  \n  \n');

            const result = hasUncommittedChanges('/path/to/worktree');

            expect(result).toBe(false);
        });

        it('should throw error when git command fails', () => {
            mockExecSync.mockImplementation(() => {
                throw new Error('fatal: not a git repository');
            });

            expect(() => hasUncommittedChanges('/path/to/worktree')).toThrow(
                "Failed to check git status in worktree '/path/to/worktree': fatal: not a git repository",
            );
        });
    });

    describe('resetWorktree', () => {
        it('should execute git reset --hard with correct parameters', () => {
            mockExecSync.mockReturnValue('');

            resetWorktree('/path/to/worktree', 'abc123');

            expect(mockExecSync).toHaveBeenCalledWith('git reset --hard abc123', {
                cwd: '/path/to/worktree',
                stdio: 'ignore',
            });
        });

        it('should throw error when git reset fails', () => {
            mockExecSync.mockImplementation(() => {
                throw new Error('fatal: invalid object name');
            });

            expect(() => resetWorktree('/path/to/worktree', 'invalid')).toThrow(
                "Failed to reset worktree '/path/to/worktree': fatal: invalid object name",
            );
        });
    });

    describe('pushWorktree', () => {
        it('should execute git push --force with correct parameters', () => {
            mockExecSync.mockReturnValue('');

            pushWorktree('/path/to/worktree');

            expect(mockExecSync).toHaveBeenCalledWith('git push --force', {
                cwd: '/path/to/worktree',
                stdio: 'ignore',
            });
        });

        it('should throw error when git push fails', () => {
            mockExecSync.mockImplementation(() => {
                throw new Error('fatal: unable to access remote repository');
            });

            expect(() => pushWorktree('/path/to/worktree')).toThrow(
                "Failed to push worktree '/path/to/worktree': fatal: unable to access remote repository",
            );
        });

        it('should throw error with generic message when error is not an Error instance', () => {
            mockExecSync.mockImplementation(() => {
                throw 'string error';
            });

            expect(() => pushWorktree('/path/to/worktree')).toThrow(
                "Failed to push worktree '/path/to/worktree'",
            );
        });
    });
});
