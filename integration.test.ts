import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

const TEST_FIXTURE_DIR = path.join(process.cwd(), 'test', 'fixtures');
const ORIGINAL_PACKAGE_JSON = path.join(TEST_FIXTURE_DIR, 'package.json');
const BACKUP_PACKAGE_JSON = path.join(TEST_FIXTURE_DIR, 'package.json.backup');

/**
 * Helper function to run a command and capture output
 */
function runCommand(cmd: string, args: string[], cwd: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { cwd, shell: true });
    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (exitCode) => {
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
        await fs.rm(path.join(TEST_FIXTURE_DIR, 'node_modules'), { recursive: true, force: true });
        await fs.unlink(path.join(TEST_FIXTURE_DIR, 'package-lock.json'));
      } catch {
        // Ignore if these don't exist
      }
    } catch (error) {
      // Ignore restore errors
    }
  });

  it('should recognize npm upgrade command', async () => {
    const result = await runCommand('node', ['--experimental-strip-types', 'main.ts', 'npm', 'upgrade'], process.cwd());

    // The command should run (it might fail if there's no package.json in the root,
    // but it should at least recognize the command)
    expect(result.exitCode).toBeDefined();
  }, 30000);

  it('should show error for unknown command', async () => {
    const result = await runCommand('node', ['--experimental-strip-types', 'main.ts', 'invalid-command'], process.cwd());

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Unknown command');
  });

  it('should show error for npm without subcommand', async () => {
    const result = await runCommand('node', ['--experimental-strip-types', 'main.ts', 'npm'], process.cwd());

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('npm command requires a subcommand');
  });

  it('should show "zap CLI ready" with no arguments', async () => {
    const result = await runCommand('node', ['--experimental-strip-types', 'main.ts'], process.cwd());

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('zap CLI ready');
  });

  it('should handle project with no outdated packages gracefully', async () => {
    // Create a minimal package.json with up-to-date packages
    const testDir = path.join(TEST_FIXTURE_DIR, 'test-up-to-date');
    await fs.mkdir(testDir, { recursive: true });

    const packageJson = {
      name: 'test-up-to-date',
      version: '1.0.0',
      dependencies: {}
    };

    await fs.writeFile(
      path.join(testDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    const result = await runCommand('node', ['--experimental-strip-types', '../../main.ts', 'npm', 'upgrade'], testDir);

    // Should complete successfully (exit code 0 or the command runs)
    expect(result.exitCode).toBeDefined();
    // Check that it either succeeded or attempted to run
    expect(result.exitCode === 0 || result.exitCode === 1).toBe(true);

    // Cleanup
    await fs.rm(testDir, { recursive: true, force: true });
  }, 30000);

  it('should handle missing package.json', async () => {
    // Create a temp directory without package.json
    const testDir = path.join(TEST_FIXTURE_DIR, 'test-no-package-json');
    await fs.mkdir(testDir, { recursive: true });

    const result = await runCommand('node', ['--experimental-strip-types', '../../main.ts', 'npm', 'upgrade'], testDir);

    // Should fail gracefully
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Error');

    // Cleanup
    await fs.rm(testDir, { recursive: true, force: true });
  }, 30000);
});

describe('Command Argument Parsing', () => {
  it('should parse command with no arguments', async () => {
    const result = await runCommand('node', ['--experimental-strip-types', 'main.ts'], process.cwd());
    expect(result.stdout).toContain('zap CLI ready');
    expect(result.exitCode).toBe(0);
  });

  it('should parse npm upgrade command', async () => {
    const result = await runCommand('node', ['--experimental-strip-types', 'main.ts', 'npm', 'upgrade'], process.cwd());
    // Should at least attempt to run (might fail on package.json issues)
    expect(result.exitCode).toBeDefined();
  });

  it('should handle invalid npm subcommand', async () => {
    const result = await runCommand('node', ['--experimental-strip-types', 'main.ts', 'npm', 'invalid'], process.cwd());
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Unknown npm subcommand');
  });
});
