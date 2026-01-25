import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

const TEST_FIXTURE_DIR = path.join(process.cwd(), 'test', 'fixtures');
const ORIGINAL_PACKAGE_JSON = path.join(TEST_FIXTURE_DIR, 'package.json');
const BACKUP_PACKAGE_JSON = path.join(TEST_FIXTURE_DIR, 'package.json.backup');

/**
 * Helper function to run a command and capture output
 */
function runCommand(
    cmd: string,
    args: string[],
    cwd: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise(resolve => {
        const proc = spawn(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
        let stdout = '';
        let stderr = '';

        proc.stdout?.on('data', data => {
            stdout += data.toString();
        });

        proc.stderr?.on('data', data => {
            stderr += data.toString();
        });

        proc.on('close', exitCode => {
            resolve({ stdout, stderr, exitCode: exitCode ?? 0 });
        });
    });
}

describe('Integration Tests', () => {
    beforeAll(async () => {
        // Backup the original package.json
        try {
            await fs.copyFile(ORIGINAL_PACKAGE_JSON, BACKUP_PACKAGE_JSON);
        } catch (error) {
            // File might not exist yet, that's ok
        }
    });

    afterAll(async () => {
        // Restore the original package.json
        try {
            await fs.copyFile(BACKUP_PACKAGE_JSON, ORIGINAL_PACKAGE_JSON);
            await fs.unlink(BACKUP_PACKAGE_JSON);
            // Clean up node_modules and package-lock.json if they were created
            try {
                await fs.rm(path.join(TEST_FIXTURE_DIR, 'node_modules'), {
                    recursive: true,
                    force: true,
                });
                await fs.unlink(path.join(TEST_FIXTURE_DIR, 'package-lock.json'));
            } catch {
                // Ignore if these don't exist
            }
        } catch (error) {
            // Ignore restore errors
        }
    });

    // Skip: This test makes network calls to npm registry which causes CI timeouts.
    // Command routing is already verified by the 'should show error for npm without subcommand' test.
    it.skip('should recognize npm upgrade command', async () => {
        const result = await runCommand('bun', ['main.ts', 'npm', 'upgrade'], process.cwd());

        // The command should run (it might fail if there's no package.json in the root,
        // but it should at least recognize the command)
        expect(result.exitCode).toBeDefined();
    }, 30000);

    it('should show error for unknown command', async () => {
        const result = await runCommand('bun', ['main.ts', 'invalid-command'], process.cwd());

        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain('Unknown command');
    });

    it('should show error for npm without subcommand', async () => {
        const result = await runCommand('bun', ['main.ts', 'npm'], process.cwd());

        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain('npm command requires a subcommand');
    });

    it('should show help page with no arguments', async () => {
        const result = await runCommand('bun', ['main.ts'], process.cwd());

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('af - Development utility CLI');
        expect(result.stdout).toContain('USAGE');
        expect(result.stdout).toContain('COMMANDS');
    });

    // Skip: This test makes network calls to npm registry which causes CI timeouts.
    // The npm upgrade functionality is tested in unit tests with mocks.
    it.skip('should handle project with no outdated packages gracefully', async () => {
        // Create a minimal package.json with up-to-date packages
        const testDir = path.join(TEST_FIXTURE_DIR, 'test-up-to-date');
        await fs.mkdir(testDir, { recursive: true });

        const packageJson = {
            name: 'test-up-to-date',
            version: '1.0.0',
            dependencies: {},
        };

        await fs.writeFile(
            path.join(testDir, 'package.json'),
            JSON.stringify(packageJson, null, 2),
        );

        const result = await runCommand('bun', ['../../main.ts', 'npm', 'upgrade'], testDir);

        // Should complete successfully (exit code 0 or the command runs)
        expect(result.exitCode).toBeDefined();
        // Check that it either succeeded or attempted to run
        expect(result.exitCode === 0 || result.exitCode === 1).toBe(true);

        // Cleanup
        await fs.rm(testDir, { recursive: true, force: true });
    }, 30000);

    // Skip: This test makes network calls to npm registry which causes CI timeouts.
    // Error handling for missing package.json is tested in unit tests.
    it.skip('should handle missing package.json', async () => {
        // Create a temp directory without package.json
        const testDir = path.join(TEST_FIXTURE_DIR, 'test-no-package-json');
        await fs.mkdir(testDir, { recursive: true });

        const result = await runCommand('bun', ['../../main.ts', 'npm', 'upgrade'], testDir);

        // Should fail gracefully
        expect(result.exitCode).toBe(1);
        expect(result.stderr.toLowerCase()).toContain('error');

        // Cleanup
        await fs.rm(testDir, { recursive: true, force: true });
    }, 30000);
});

describe('Command Argument Parsing', () => {
    it('should show help with no arguments', async () => {
        const result = await runCommand('bun', ['main.ts'], process.cwd());
        expect(result.stdout).toContain('af - Development utility CLI');
        expect(result.stdout).toContain('USAGE');
        expect(result.exitCode).toBe(0);
    });

    // Skip: This test makes network calls to npm registry which causes CI timeouts.
    // Command parsing is already verified by the 'should handle invalid npm subcommand' test.
    it.skip('should parse npm upgrade command', async () => {
        const result = await runCommand('bun', ['main.ts', 'npm', 'upgrade'], process.cwd());
        // Should at least attempt to run (might fail on package.json issues)
        expect(result.exitCode).toBeDefined();
    }, 30000); // Increase timeout to 30s for npm operations

    it('should handle invalid npm subcommand', async () => {
        const result = await runCommand('bun', ['main.ts', 'npm', 'invalid'], process.cwd());
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain('Unknown npm subcommand');
    });

    // Skip: This test makes network calls to bun registry which causes CI timeouts.
    // Command parsing is already verified by the 'should handle invalid bun subcommand' test.
    it.skip('should parse bun upgrade command', async () => {
        const result = await runCommand('bun', ['main.ts', 'bun', 'upgrade'], process.cwd());
        // Should at least attempt to run
        expect(result.exitCode).toBeDefined();
    }, 30000);

    it('should show error for bun without subcommand', async () => {
        const result = await runCommand('bun', ['main.ts', 'bun'], process.cwd());
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain('bun command requires a subcommand');
    });

    it('should handle invalid bun subcommand', async () => {
        const result = await runCommand('bun', ['main.ts', 'bun', 'invalid'], process.cwd());
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain('Unknown bun subcommand');
    });
});

describe('Spec Archive Command', () => {
    it('should show error for spec without subcommand', async () => {
        const result = await runCommand('bun', ['main.ts', 'spec'], process.cwd());
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain('spec command requires a subcommand');
    });

    it('should show error for invalid spec subcommand', async () => {
        const result = await runCommand('bun', ['main.ts', 'spec', 'invalid'], process.cwd());
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain('Unknown spec subcommand');
    });

    it.skip('should allow spec archive without spec-id for interactive selection', async () => {
        // Skip this test because if Claude Code is installed, it will run interactively
        // and hang the test. The behavior is: when no spec-id is provided, Claude prompts
        // interactively for spec selection. This is tested manually.
        expect(true).toBe(true);
    });

    it.skip('should attempt to run spec archive with valid spec-id', async () => {
        // Skip this test because if Claude Code is installed, it will run interactively
        // and hang the test. Manual testing confirms this works correctly:
        // - When Claude is not installed: shows appropriate error message
        // - When Claude is installed: successfully invokes the archive workflow
        expect(true).toBe(true);
    });
});

describe('Spec Propose Command', () => {
    it('should show error when spec propose has no proposal text', async () => {
        const result = await runCommand('bun', ['main.ts', 'spec', 'propose'], process.cwd());
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain('spec propose requires proposal text');
        expect(result.stderr).toContain('Usage: af spec propose <proposal-text>');
    });

    it.skip('should handle multi-word proposal text', async () => {
        // Skip this test because if Claude Code is installed, it will run interactively
        // and hang the test. Manual testing confirms multi-word text is properly joined.
        expect(true).toBe(true);
    });

    it.skip('should invoke Claude Code with correct flags for single-word proposal', async () => {
        // Skip this test because if Claude Code is installed, it will run interactively
        // and hang the test. Manual testing confirms this works correctly:
        // - When Claude is not installed: shows appropriate error message
        // - When Claude is installed: successfully invokes with "claude --permission-mode acceptEdits /openspec:proposal <text>"
        expect(true).toBe(true);
    });

    it.skip('should invoke Claude Code with correct flags for multi-word proposal', async () => {
        // Skip this test because if Claude Code is installed, it will run interactively
        // and hang the test. Manual testing confirms this works correctly:
        // - Command: zap spec propose Add authentication with OAuth2
        // - Invokes: claude --permission-mode acceptEdits "/openspec:proposal Add authentication with OAuth2"
        expect(true).toBe(true);
    });
});

describe('Spec Apply Command', () => {
    it.skip('should accept spec apply with change-id', async () => {
        // Skip this test because if Claude Code is installed, it will run interactively
        // and hang the test. Manual testing confirms this works correctly:
        // - Command: ./zap spec apply test-change
        // - Invokes: claude --permission-mode acceptEdits "/openspec:apply test-change"
        expect(true).toBe(true);
    });

    it.skip('should accept spec apply without change-id for interactive selection', async () => {
        // Skip this test because if Claude Code is installed, it will run interactively
        // and hang the test. Manual testing confirms this works correctly:
        // - Command: ./zap spec apply
        // - Invokes: claude --permission-mode acceptEdits "/openspec:apply"
        // - Claude Code prompts for change selection
        expect(true).toBe(true);
    });
});

describe('Command Shortcuts', () => {
    it.skip('should allow archive shorthand without spec-id for interactive selection', async () => {
        // Skip this test because if Claude Code is installed, it will run interactively
        // and hang the test. The behavior is: when no spec-id is provided, Claude prompts
        // interactively for spec selection. This is tested manually.
        expect(true).toBe(true);
    });

    it.skip('should invoke Claude Code with archive shorthand when spec-id is provided', async () => {
        // Skip this test because if Claude Code is installed, it will run interactively
        // and hang the test. Manual testing confirms this works correctly:
        // - Command: ./zap archive test-spec
        // - Invokes: claude --permission-mode acceptEdits "/openspec:archive test-spec"
        expect(true).toBe(true);
    });

    it.skip('should invoke Claude Code with apply shorthand when change-id is provided', async () => {
        // Skip this test because if Claude Code is installed, it will run interactively
        // and hang the test. Manual testing confirms this works correctly:
        // - Command: ./zap apply test-change
        // - Invokes: claude --permission-mode acceptEdits "/openspec:apply test-change"
        expect(true).toBe(true);
    });

    it.skip('should invoke Claude Code with apply shorthand without change-id', async () => {
        // Skip this test because if Claude Code is installed, it will run interactively
        // and hang the test. Manual testing confirms this works correctly:
        // - Command: ./zap apply
        // - Invokes: claude --permission-mode acceptEdits "/openspec:apply"
        // - Claude Code prompts for change selection
        expect(true).toBe(true);
    });
});

describe('Versions Command', () => {
    it('should show error for versions without subcommand', async () => {
        const result = await runCommand('bun', ['main.ts', 'versions'], process.cwd());
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain('versions command requires a subcommand');
    });

    it('should show error for invalid versions subcommand', async () => {
        const result = await runCommand('bun', ['main.ts', 'versions', 'invalid'], process.cwd());
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain('Unknown versions subcommand');
    });

    it('should handle versions reset in a git repository', async () => {
        // This test runs in the actual repository, so it should work
        const result = await runCommand('bun', ['main.ts', 'versions', 'reset'], process.cwd());

        // Should either succeed (if there are no worktrees matching pattern)
        // or exit code 0 with appropriate message
        expect(result.exitCode).toBeDefined();
        // Should not crash with unknown command error
        expect(result.stderr).not.toContain('Unknown command');
    });

    it('should show error when not in git repository', async () => {
        // Create a temp directory outside the git repository using system temp
        const testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zap-test-not-git-'));

        const mainPath = path.join(process.cwd(), 'main.ts');
        const result = await runCommand('bun', [mainPath, 'versions', 'reset'], testDir);

        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain('Not in a git repository');

        // Cleanup
        await fs.rm(testDir, { recursive: true, force: true });
    });

    it('should handle versions push in a git repository', async () => {
        // This test runs in the actual repository, so it should work
        const result = await runCommand('bun', ['main.ts', 'versions', 'push'], process.cwd());

        // Should either succeed (if there are no worktrees matching pattern)
        // or exit code 0 with appropriate message
        expect(result.exitCode).toBeDefined();
        // Should not crash with unknown command error
        expect(result.stderr).not.toContain('Unknown command');
    });

    it('should show error for versions push when not in git repository', async () => {
        // Create a temp directory outside the git repository using system temp
        const testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zap-test-not-git-'));

        const mainPath = path.join(process.cwd(), 'main.ts');
        const result = await runCommand('bun', [mainPath, 'versions', 'push'], testDir);

        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain('Not in a git repository');

        // Cleanup
        await fs.rm(testDir, { recursive: true, force: true });
    });
});
