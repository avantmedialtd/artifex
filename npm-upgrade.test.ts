import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import * as child_process from 'child_process';
import { getOutdatedPackages, upgradePackage, upgradeAllPackages } from './npm-upgrade.js';

// Mock child_process
vi.mock('child_process');

class MockChildProcess extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();

  kill() {}
}

describe('npm-upgrade', () => {
  let mockSpawn: ReturnType<typeof vi.fn>;
  let mockProcess: MockChildProcess;

  beforeEach(() => {
    mockProcess = new MockChildProcess();
    mockSpawn = vi.fn(() => mockProcess);
    vi.spyOn(child_process, 'spawn').mockImplementation(mockSpawn);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getOutdatedPackages', () => {
    it('should return list of outdated packages', async () => {
      const outdatedJson = {
        'package-a': {
          current: '1.0.0',
          wanted: '1.0.1',
          latest: '2.0.0',
          dependent: 'test-project',
          location: 'node_modules/package-a',
        },
        'package-b': {
          current: '3.0.0',
          wanted: '3.1.0',
          latest: '3.1.0',
          dependent: 'test-project',
          location: 'node_modules/package-b',
        },
      };

      const promise = getOutdatedPackages();

      // Simulate npm outdated output
      mockProcess.stdout.emit('data', JSON.stringify(outdatedJson));
      mockProcess.emit('close', 1); // npm outdated returns 1 when packages are outdated

      const result = await promise;
      expect(result).toEqual(['package-a', 'package-b']);
      expect(mockSpawn).toHaveBeenCalledWith('npm', ['outdated', '--json'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true,
      });
    });

    it('should return empty array when all packages are up to date', async () => {
      const promise = getOutdatedPackages();

      mockProcess.stdout.emit('data', '');
      mockProcess.emit('close', 0); // npm outdated returns 0 when all packages are up to date

      const result = await promise;
      expect(result).toEqual([]);
    });

    it('should handle empty JSON output', async () => {
      const promise = getOutdatedPackages();

      mockProcess.stdout.emit('data', '{}');
      mockProcess.emit('close', 1);

      const result = await promise;
      expect(result).toEqual([]);
    });

    it('should reject on npm outdated failure', async () => {
      const promise = getOutdatedPackages();

      mockProcess.stderr.emit('data', 'npm error: something went wrong');
      mockProcess.emit('close', 2); // Non-standard exit code

      await expect(promise).rejects.toThrow('npm outdated failed with code 2');
    });

    it('should reject on invalid JSON output', async () => {
      const promise = getOutdatedPackages();

      mockProcess.stdout.emit('data', 'invalid json');
      mockProcess.emit('close', 1);

      await expect(promise).rejects.toThrow('Failed to parse npm outdated output');
    });

    it('should reject on process error', async () => {
      const promise = getOutdatedPackages();

      mockProcess.emit('error', new Error('spawn failed'));

      await expect(promise).rejects.toThrow('Failed to execute npm outdated: spawn failed');
    });
  });

  describe('upgradePackage', () => {
    it('should successfully upgrade a package', async () => {
      const promise = upgradePackage('test-package');

      mockProcess.emit('close', 0);

      const result = await promise;
      expect(result).toEqual({
        package: 'test-package',
        success: true,
      });
      expect(mockSpawn).toHaveBeenCalledWith('npm', ['install', 'test-package@latest'], {
        stdio: ['ignore', 'inherit', 'inherit'],
        shell: true,
      });
    });

    it('should handle package upgrade failure', async () => {
      const promise = upgradePackage('test-package');

      mockProcess.emit('close', 1);

      const result = await promise;
      expect(result).toEqual({
        package: 'test-package',
        success: false,
        error: 'npm install failed with exit code 1',
      });
    });

    it('should handle process error', async () => {
      const promise = upgradePackage('test-package');

      mockProcess.emit('error', new Error('spawn failed'));

      const result = await promise;
      expect(result).toEqual({
        package: 'test-package',
        success: false,
        error: 'spawn failed',
      });
    });
  });

  describe('upgradeAllPackages', () => {
    it('should upgrade all packages sequentially', async () => {
      const packages = ['package-a', 'package-b', 'package-c'];

      const promise = upgradeAllPackages(packages);

      // Wait for first spawn call
      await new Promise(resolve => setImmediate(resolve));
      mockProcess.emit('close', 0);

      // Create new mock for second package
      const mockProcess2 = new MockChildProcess();
      mockSpawn.mockReturnValueOnce(mockProcess2);
      await new Promise(resolve => setImmediate(resolve));
      mockProcess2.emit('close', 0);

      // Create new mock for third package
      const mockProcess3 = new MockChildProcess();
      mockSpawn.mockReturnValueOnce(mockProcess3);
      await new Promise(resolve => setImmediate(resolve));
      mockProcess3.emit('close', 0);

      const results = await promise;

      expect(results).toHaveLength(3);
      expect(results[0]).toEqual({ package: 'package-a', success: true });
      expect(results[1]).toEqual({ package: 'package-b', success: true });
      expect(results[2]).toEqual({ package: 'package-c', success: true });
      expect(mockSpawn).toHaveBeenCalledTimes(3);
    });

    it('should continue upgrading after a failure', async () => {
      const packages = ['package-a', 'package-b'];

      const promise = upgradeAllPackages(packages);

      // First package fails
      await new Promise(resolve => setImmediate(resolve));
      mockProcess.emit('close', 1);

      // Second package succeeds
      const mockProcess2 = new MockChildProcess();
      mockSpawn.mockReturnValueOnce(mockProcess2);
      await new Promise(resolve => setImmediate(resolve));
      mockProcess2.emit('close', 0);

      const results = await promise;

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(false);
      expect(results[1].success).toBe(true);
    });

    it('should handle empty package list', async () => {
      const results = await upgradeAllPackages([]);
      expect(results).toEqual([]);
      expect(mockSpawn).not.toHaveBeenCalled();
    });
  });
});
