import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { stageDirectory, createCommit, stageAndCommit } from './git.ts';

describe('git utilities', () => {
    // Store original cwd at describe level to ensure proper restoration
    const originalCwd = process.cwd();
    // Use absolute paths to avoid path stacking issues
    const testDir = resolve(originalCwd, 'test/tmp/git-test');
    const testRepo = resolve(testDir, 'repo');

    beforeEach(() => {
        // Always start from original cwd
        process.chdir(originalCwd);
        // Create a temporary git repository for testing
        mkdirSync(testRepo, { recursive: true });
        execSync('git init', { cwd: testRepo, stdio: 'pipe' });
        execSync('git config user.name "Test User"', { cwd: testRepo, stdio: 'pipe' });
        execSync('git config user.email "test@example.com"', { cwd: testRepo, stdio: 'pipe' });
    });

    afterEach(() => {
        // Always restore cwd FIRST, before cleanup
        process.chdir(originalCwd);
        rmSync(testDir, { recursive: true, force: true });
    });

    describe('stageDirectory', () => {
        it('should stage files in a directory', () => {
            // Create files in a subdirectory
            mkdirSync(`${testRepo}/subdir`, { recursive: true });
            writeFileSync(`${testRepo}/subdir/file1.txt`, 'content1');
            writeFileSync(`${testRepo}/subdir/file2.txt`, 'content2');

            // Change to test repo
            const originalCwd = process.cwd();
            process.chdir(testRepo);

            const result = stageDirectory('subdir');
            expect(result).toBe(true);

            // Verify files are staged
            const status = execSync('git status --porcelain', { encoding: 'utf-8' });
            expect(status).toContain('A  subdir/file1.txt');
            expect(status).toContain('A  subdir/file2.txt');

            process.chdir(originalCwd);
        });

        it('should return false for non-existent directory', () => {
            const originalCwd = process.cwd();
            process.chdir(testRepo);

            const result = stageDirectory('non-existent-dir');
            expect(result).toBe(false);

            process.chdir(originalCwd);
        });
    });

    describe('createCommit', () => {
        it('should create a commit with the given message', () => {
            // Create and stage a file
            writeFileSync(`${testRepo}/file.txt`, 'content');
            execSync('git add file.txt', { cwd: testRepo, stdio: 'pipe' });

            const originalCwd = process.cwd();
            process.chdir(testRepo);

            const result = createCommit('Test commit message');
            expect(result).toBe(true);

            // Verify commit was created
            const log = execSync('git log --oneline', { encoding: 'utf-8' });
            expect(log).toContain('Test commit message');

            process.chdir(originalCwd);
        });

        it('should return false when there are no staged changes', () => {
            const originalCwd = process.cwd();
            process.chdir(testRepo);

            const result = createCommit('Test commit');
            expect(result).toBe(false);

            process.chdir(originalCwd);
        });
    });

    describe('stageAndCommit', () => {
        it('should stage directory and create commit successfully', () => {
            // Create files in a subdirectory
            mkdirSync(`${testRepo}/changes`, { recursive: true });
            writeFileSync(`${testRepo}/changes/proposal.md`, '# Test Proposal');
            writeFileSync(`${testRepo}/changes/tasks.md`, '- Task 1');

            const originalCwd = process.cwd();
            process.chdir(testRepo);

            const result = stageAndCommit('changes', 'Propose: Test Proposal');
            expect(result.success).toBe(true);
            expect(result.error).toBeUndefined();

            // Verify commit was created
            const log = execSync('git log --oneline', { encoding: 'utf-8' });
            expect(log).toContain('Propose: Test Proposal');

            process.chdir(originalCwd);
        });

        it('should return error when staging fails', () => {
            const originalCwd = process.cwd();
            process.chdir(testRepo);

            const result = stageAndCommit('non-existent-dir', 'Test commit');
            expect(result.success).toBe(false);
            expect(result.error).toBe('Failed to stage files');

            process.chdir(originalCwd);
        });

        it('should return error when commit fails', () => {
            const originalCwd = process.cwd();
            process.chdir(testRepo);

            // Create an empty directory that can be staged but has no files
            mkdirSync('empty-dir', { recursive: true });
            writeFileSync('empty-dir/.gitkeep', '');
            execSync('git add empty-dir/.gitkeep', { stdio: 'pipe' });
            execSync('git commit -m "Initial"', { stdio: 'pipe' });

            // Now try to commit with no changes
            const result = stageAndCommit('empty-dir', 'Test commit');
            expect(result.success).toBe(false);
            expect(result.error).toBe('Failed to create commit');

            process.chdir(originalCwd);
        });
    });
});
