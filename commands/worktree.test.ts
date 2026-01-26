import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import {
    isGitRepository,
    getGitRoot,
    worktreeExists,
    parseGitInfoExclude,
    findExcludedFiles,
    getFilesToCopy,
    copyFileToWorktree,
    createWorktree,
    handleWorktreeNew,
    handleWorktree,
    getCurrentWorktree,
    findWorktreeByName,
    handleWorktreeReset,
} from './worktree.ts';

describe('worktree command', () => {
    const originalCwd = process.cwd();
    // Use OS temp dir so we're outside any existing git repo
    const testDir = resolve(tmpdir(), `worktree-test-${Date.now()}`);
    const testRepo = resolve(testDir, 'repo');

    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        process.chdir(originalCwd);
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(console, 'log').mockImplementation(() => {});

        // Create test directory and git repo
        mkdirSync(testRepo, { recursive: true });
        execSync('git init', { cwd: testRepo, stdio: 'pipe' });
        execSync('git config user.name "Test User"', { cwd: testRepo, stdio: 'pipe' });
        execSync('git config user.email "test@example.com"', { cwd: testRepo, stdio: 'pipe' });

        // Create initial commit
        writeFileSync(`${testRepo}/README.md`, '# Test');
        execSync('git add .', { cwd: testRepo, stdio: 'pipe' });
        execSync('git commit -m "Initial commit"', { cwd: testRepo, stdio: 'pipe' });
    });

    afterEach(() => {
        process.chdir(originalCwd);
        vi.restoreAllMocks();
        rmSync(testDir, { recursive: true, force: true });
    });

    describe('isGitRepository', () => {
        it('should return true when in a git repository', () => {
            process.chdir(testRepo);

            expect(isGitRepository()).toBe(true);
        });

        it('should return false when not in a git repository', () => {
            const nonGitDir = resolve(testDir, 'non-git');
            mkdirSync(nonGitDir, { recursive: true });
            process.chdir(nonGitDir);

            expect(isGitRepository()).toBe(false);
        });
    });

    describe('getGitRoot', () => {
        it('should return the git root path', () => {
            process.chdir(testRepo);

            // Use realpathSync to handle macOS /var -> /private/var symlinks
            expect(getGitRoot()).toBe(realpathSync(testRepo));
        });

        it('should return git root from subdirectory', () => {
            const subDir = resolve(testRepo, 'subdir');
            mkdirSync(subDir, { recursive: true });
            process.chdir(subDir);

            expect(getGitRoot()).toBe(realpathSync(testRepo));
        });

        it('should return null when not in a repo', () => {
            const nonGitDir = resolve(testDir, 'non-git');
            mkdirSync(nonGitDir, { recursive: true });
            process.chdir(nonGitDir);

            expect(getGitRoot()).toBeNull();
        });
    });

    describe('worktreeExists', () => {
        it('should return true when path exists', () => {
            expect(worktreeExists(testRepo)).toBe(true);
        });

        it('should return false when path does not exist', () => {
            expect(worktreeExists(resolve(testDir, 'nonexistent'))).toBe(false);
        });
    });

    describe('parseGitInfoExclude', () => {
        it('should return empty array when exclude file does not exist', () => {
            const result = parseGitInfoExclude(testRepo);

            expect(result).toEqual([]);
        });

        it('should parse exclude patterns, filtering comments and empty lines', () => {
            const excludePath = resolve(testRepo, '.git/info/exclude');
            writeFileSync(
                excludePath,
                '# This is a comment\n\n*.log\n  node_modules/  \n# Another comment\n.env.local\n',
            );

            const result = parseGitInfoExclude(testRepo);

            expect(result).toEqual(['*.log', 'node_modules/', '.env.local']);
        });
    });

    describe('findExcludedFiles', () => {
        it('should return empty array when no files match exclude patterns', () => {
            const result = findExcludedFiles(testRepo);

            expect(result).toEqual([]);
        });

        it('should return files matching exclude patterns', () => {
            // Add exclude patterns
            const excludePath = resolve(testRepo, '.git/info/exclude');
            writeFileSync(excludePath, '*.log\nsecrets/\n');

            // Create matching files
            writeFileSync(`${testRepo}/debug.log`, 'log content');
            mkdirSync(`${testRepo}/secrets`, { recursive: true });
            writeFileSync(`${testRepo}/secrets/api.key`, 'secret');

            const result = findExcludedFiles(testRepo);

            expect(result).toContain('debug.log');
            expect(result).toContain('secrets/api.key');
        });
    });

    describe('getFilesToCopy', () => {
        it('should include .env if it exists', () => {
            writeFileSync(`${testRepo}/.env`, 'KEY=value');

            const result = getFilesToCopy(testRepo);

            expect(result).toContain('.env');
        });

        it('should include .env.local if it exists', () => {
            writeFileSync(`${testRepo}/.env.local`, 'KEY=value');

            const result = getFilesToCopy(testRepo);

            expect(result).toContain('.env.local');
        });

        it('should include excluded files', () => {
            const excludePath = resolve(testRepo, '.git/info/exclude');
            writeFileSync(excludePath, '*.key\n');
            writeFileSync(`${testRepo}/secret.key`, 'secret');

            const result = getFilesToCopy(testRepo);

            expect(result).toContain('secret.key');
        });

        it('should not include duplicates', () => {
            // Add .env to exclude patterns
            const excludePath = resolve(testRepo, '.git/info/exclude');
            writeFileSync(excludePath, '.env\n');
            writeFileSync(`${testRepo}/.env`, 'KEY=value');

            const result = getFilesToCopy(testRepo);

            // .env should only appear once
            expect(result.filter(f => f === '.env').length).toBe(1);
        });
    });

    describe('copyFileToWorktree', () => {
        it('should copy file to target directory', () => {
            writeFileSync(`${testRepo}/.env`, 'KEY=value');
            const targetDir = resolve(testDir, 'target');
            mkdirSync(targetDir, { recursive: true });

            const result = copyFileToWorktree(testRepo, targetDir, '.env');

            expect(result).toBe(true);
            expect(existsSync(`${targetDir}/.env`)).toBe(true);
            expect(readFileSync(`${targetDir}/.env`, 'utf-8')).toBe('KEY=value');
        });

        it('should create parent directories if needed', () => {
            mkdirSync(`${testRepo}/nested/dir`, { recursive: true });
            writeFileSync(`${testRepo}/nested/dir/file.txt`, 'content');
            const targetDir = resolve(testDir, 'target');
            mkdirSync(targetDir, { recursive: true });

            const result = copyFileToWorktree(testRepo, targetDir, 'nested/dir/file.txt');

            expect(result).toBe(true);
            expect(existsSync(`${targetDir}/nested/dir/file.txt`)).toBe(true);
        });

        it('should return false when source file does not exist', () => {
            const targetDir = resolve(testDir, 'target');
            mkdirSync(targetDir, { recursive: true });

            const result = copyFileToWorktree(testRepo, targetDir, 'nonexistent.txt');

            expect(result).toBe(false);
        });
    });

    describe('createWorktree', () => {
        it('should create worktree with new branch', () => {
            process.chdir(testRepo);

            const result = createWorktree('feature-x');

            expect(result.success).toBe(true);
            // Use realpathSync to handle macOS /var -> /private/var symlinks
            expect(result.path).toBe(realpathSync(resolve(testDir, 'feature-x')));
            expect(existsSync(resolve(testDir, 'feature-x'))).toBe(true);

            // Verify branch was created
            const branches = execSync('git branch -a', { cwd: testRepo, encoding: 'utf-8' });
            expect(branches).toContain('feature-x');

            // Cleanup
            execSync(`git worktree remove --force "${resolve(testDir, 'feature-x')}"`, {
                cwd: testRepo,
                stdio: 'pipe',
            });
        });

        it('should create worktree with detached HEAD', () => {
            process.chdir(testRepo);

            const result = createWorktree('detached-wt', true);

            expect(result.success).toBe(true);
            expect(existsSync(resolve(testDir, 'detached-wt'))).toBe(true);

            // Verify detached HEAD
            const head = execSync('git rev-parse --abbrev-ref HEAD', {
                cwd: resolve(testDir, 'detached-wt'),
                encoding: 'utf-8',
            }).trim();
            expect(head).toBe('HEAD');

            // Cleanup
            execSync(`git worktree remove --force "${resolve(testDir, 'detached-wt')}"`, {
                cwd: testRepo,
                stdio: 'pipe',
            });
        });

        it('should return error if target directory exists', () => {
            process.chdir(testRepo);
            const existingDir = resolve(testDir, 'existing');
            mkdirSync(existingDir, { recursive: true });

            const result = createWorktree('existing');

            expect(result.success).toBe(false);
            expect(result.error).toContain('Directory already exists');
        });

        it('should return error if not in a git repository', () => {
            const nonGitDir = resolve(testDir, 'non-git');
            mkdirSync(nonGitDir, { recursive: true });
            process.chdir(nonGitDir);

            const result = createWorktree('test');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Not in a git repository');
        });

        it('should return error if branch already exists', () => {
            process.chdir(testRepo);
            // Create a branch
            execSync('git branch existing-branch', { cwd: testRepo, stdio: 'pipe' });

            const result = createWorktree('existing-branch');

            expect(result.success).toBe(false);
            expect(result.error).toContain('already exists');
        });
    });

    describe('handleWorktreeNew', () => {
        it('should return error when name is not provided', () => {
            process.chdir(testRepo);

            const exitCode = handleWorktreeNew(undefined);

            expect(exitCode).toBe(1);
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Usage: af worktree new <name> [--detach]',
            );
        });

        it('should return error when name is empty', () => {
            process.chdir(testRepo);

            const exitCode = handleWorktreeNew('  ');

            expect(exitCode).toBe(1);
        });

        it('should return error when not in a git repository', () => {
            const nonGitDir = resolve(testDir, 'non-git');
            mkdirSync(nonGitDir, { recursive: true });
            process.chdir(nonGitDir);

            const exitCode = handleWorktreeNew('test');

            expect(exitCode).toBe(1);
        });

        it('should create worktree and copy env files', () => {
            process.chdir(testRepo);
            writeFileSync(`${testRepo}/.env`, 'DB_HOST=localhost');

            const exitCode = handleWorktreeNew('feature-y');

            expect(exitCode).toBe(0);
            expect(existsSync(resolve(testDir, 'feature-y'))).toBe(true);
            expect(existsSync(resolve(testDir, 'feature-y/.env'))).toBe(true);
            expect(readFileSync(resolve(testDir, 'feature-y/.env'), 'utf-8')).toBe(
                'DB_HOST=localhost',
            );

            // Cleanup
            execSync(`git worktree remove --force "${resolve(testDir, 'feature-y')}"`, {
                cwd: testRepo,
                stdio: 'pipe',
            });
        });

        it('should create detached worktree when --detach is passed', () => {
            process.chdir(testRepo);

            const exitCode = handleWorktreeNew('detached-feature', true);

            expect(exitCode).toBe(0);

            // Verify detached HEAD
            const head = execSync('git rev-parse --abbrev-ref HEAD', {
                cwd: resolve(testDir, 'detached-feature'),
                encoding: 'utf-8',
            }).trim();
            expect(head).toBe('HEAD');

            // Cleanup
            execSync(`git worktree remove --force "${resolve(testDir, 'detached-feature')}"`, {
                cwd: testRepo,
                stdio: 'pipe',
            });
        });
    });

    describe('handleWorktree', () => {
        it('should show error when no subcommand provided', async () => {
            process.chdir(testRepo);

            const exitCode = await handleWorktree([]);

            expect(exitCode).toBe(1);
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                "Run 'af help worktree' for more information.",
            );
        });

        it('should show error for unknown subcommand', async () => {
            process.chdir(testRepo);

            const exitCode = await handleWorktree(['unknown']);

            expect(exitCode).toBe(1);
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                "Run 'af help worktree' for available subcommands.",
            );
        });

        it('should route to handleWorktreeNew for "new" subcommand', async () => {
            process.chdir(testRepo);

            const exitCode = await handleWorktree(['new', 'test-wt']);

            expect(exitCode).toBe(0);
            expect(existsSync(resolve(testDir, 'test-wt'))).toBe(true);

            // Cleanup
            execSync(`git worktree remove --force "${resolve(testDir, 'test-wt')}"`, {
                cwd: testRepo,
                stdio: 'pipe',
            });
        });

        it('should parse --detach flag', async () => {
            process.chdir(testRepo);

            const exitCode = await handleWorktree(['new', 'detached-wt2', '--detach']);

            expect(exitCode).toBe(0);

            // Verify detached HEAD
            const head = execSync('git rev-parse --abbrev-ref HEAD', {
                cwd: resolve(testDir, 'detached-wt2'),
                encoding: 'utf-8',
            }).trim();
            expect(head).toBe('HEAD');

            // Cleanup
            execSync(`git worktree remove --force "${resolve(testDir, 'detached-wt2')}"`, {
                cwd: testRepo,
                stdio: 'pipe',
            });
        });

        it('should handle --detach flag before name', async () => {
            process.chdir(testRepo);

            const exitCode = await handleWorktree(['new', '--detach', 'detached-wt3']);

            expect(exitCode).toBe(0);
            expect(existsSync(resolve(testDir, 'detached-wt3'))).toBe(true);

            // Cleanup
            execSync(`git worktree remove --force "${resolve(testDir, 'detached-wt3')}"`, {
                cwd: testRepo,
                stdio: 'pipe',
            });
        });

        it('should route to handleWorktreeReset for "reset" subcommand', async () => {
            process.chdir(testRepo);

            // Create a worktree first
            execSync('git worktree add -b reset-test ../reset-test-wt', {
                cwd: testRepo,
                stdio: 'pipe',
            });

            const exitCode = await handleWorktree(['reset', 'reset-test']);

            expect(exitCode).toBe(0);

            // Cleanup
            execSync(`git worktree remove --force "${resolve(testDir, 'reset-test-wt')}"`, {
                cwd: testRepo,
                stdio: 'pipe',
            });
        });
    });

    describe('getCurrentWorktree', () => {
        it('should return null when in main repository', () => {
            process.chdir(testRepo);

            const result = getCurrentWorktree();

            expect(result).toBeNull();
        });

        it('should return worktree info when in a worktree', () => {
            process.chdir(testRepo);

            // Create a worktree
            execSync('git worktree add -b wt-current ../wt-current', {
                cwd: testRepo,
                stdio: 'pipe',
            });

            const worktreePath = resolve(testDir, 'wt-current');
            process.chdir(worktreePath);

            const result = getCurrentWorktree();

            expect(result).not.toBeNull();
            expect(result!.branch).toBe('wt-current');
            expect(result!.path).toBe(realpathSync(worktreePath));

            // Cleanup
            process.chdir(testRepo);
            execSync(`git worktree remove --force "${worktreePath}"`, {
                cwd: testRepo,
                stdio: 'pipe',
            });
        });
    });

    describe('findWorktreeByName', () => {
        it('should return worktree when found by branch name', () => {
            process.chdir(testRepo);

            // Create a worktree
            execSync('git worktree add -b find-test ../find-test-wt', {
                cwd: testRepo,
                stdio: 'pipe',
            });

            const result = findWorktreeByName('find-test');

            expect(result).not.toBeNull();
            expect(result!.branch).toBe('find-test');

            // Cleanup
            execSync(`git worktree remove --force "${resolve(testDir, 'find-test-wt')}"`, {
                cwd: testRepo,
                stdio: 'pipe',
            });
        });

        it('should return null when worktree not found', () => {
            process.chdir(testRepo);

            const result = findWorktreeByName('nonexistent-branch');

            expect(result).toBeNull();
        });
    });

    describe('handleWorktreeReset', () => {
        it('should return error when not in a git repository', () => {
            const nonGitDir = resolve(testDir, 'non-git');
            mkdirSync(nonGitDir, { recursive: true });
            process.chdir(nonGitDir);

            const exitCode = handleWorktreeReset(undefined);

            expect(exitCode).toBe(1);
        });

        it('should return error when named worktree not found', () => {
            process.chdir(testRepo);

            const exitCode = handleWorktreeReset('nonexistent');

            expect(exitCode).toBe(1);
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining("Worktree 'nonexistent' not found"),
            );
        });

        it('should return error when not in a worktree and no name provided', () => {
            process.chdir(testRepo);

            const exitCode = handleWorktreeReset(undefined);

            expect(exitCode).toBe(1);
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining('Not in a worktree'),
            );
        });

        it('should return error when worktree has uncommitted changes', () => {
            process.chdir(testRepo);

            // Create a worktree
            execSync('git worktree add -b dirty-test ../dirty-test-wt', {
                cwd: testRepo,
                stdio: 'pipe',
            });

            const worktreePath = resolve(testDir, 'dirty-test-wt');

            // Create uncommitted changes
            writeFileSync(`${worktreePath}/dirty.txt`, 'uncommitted content');

            const exitCode = handleWorktreeReset('dirty-test');

            expect(exitCode).toBe(1);
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining('uncommitted changes'),
            );

            // Cleanup
            execSync(`git worktree remove --force "${worktreePath}"`, {
                cwd: testRepo,
                stdio: 'pipe',
            });
        });

        it('should reset named worktree successfully', () => {
            process.chdir(testRepo);

            // Create a worktree
            execSync('git worktree add -b reset-named ../reset-named-wt', {
                cwd: testRepo,
                stdio: 'pipe',
            });

            const worktreePath = resolve(testDir, 'reset-named-wt');

            // Make a new commit in main repo
            writeFileSync(`${testRepo}/new-file.txt`, 'new content');
            execSync('git add .', { cwd: testRepo, stdio: 'pipe' });
            execSync('git commit -m "New commit"', { cwd: testRepo, stdio: 'pipe' });

            // Get the HEAD commit
            const headCommit = execSync('git rev-parse HEAD', {
                cwd: testRepo,
                encoding: 'utf-8',
            }).trim();

            // Reset the worktree
            const exitCode = handleWorktreeReset('reset-named');

            expect(exitCode).toBe(0);

            // Verify the worktree is now at the same commit
            const worktreeCommit = execSync('git rev-parse HEAD', {
                cwd: worktreePath,
                encoding: 'utf-8',
            }).trim();
            expect(worktreeCommit).toBe(headCommit);

            // Cleanup
            execSync(`git worktree remove --force "${worktreePath}"`, {
                cwd: testRepo,
                stdio: 'pipe',
            });
        });

        it('should reset current worktree when no name provided and in worktree', () => {
            process.chdir(testRepo);

            // Create a worktree
            execSync('git worktree add -b reset-current ../reset-current-wt', {
                cwd: testRepo,
                stdio: 'pipe',
            });

            const worktreePath = resolve(testDir, 'reset-current-wt');

            // Make a new commit in main repo
            writeFileSync(`${testRepo}/another-file.txt`, 'another content');
            execSync('git add .', { cwd: testRepo, stdio: 'pipe' });
            execSync('git commit -m "Another commit"', { cwd: testRepo, stdio: 'pipe' });

            // Get the HEAD commit from main repo
            const headCommit = execSync('git rev-parse HEAD', {
                cwd: testRepo,
                encoding: 'utf-8',
            }).trim();

            // Change to worktree directory and reset
            process.chdir(worktreePath);
            const exitCode = handleWorktreeReset(undefined);

            expect(exitCode).toBe(0);

            // Verify the worktree is now at the same commit
            const worktreeCommit = execSync('git rev-parse HEAD', {
                cwd: worktreePath,
                encoding: 'utf-8',
            }).trim();
            expect(worktreeCommit).toBe(headCommit);

            // Cleanup
            process.chdir(testRepo);
            execSync(`git worktree remove --force "${worktreePath}"`, {
                cwd: testRepo,
                stdio: 'pipe',
            });
        });
    });
});
