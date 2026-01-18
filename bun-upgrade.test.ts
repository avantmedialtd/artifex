import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import {
    parseBunOutdatedOutput,
    getBunOutdatedPackages,
    bunUpgradePackage,
    bunUpgradeAllPackages,
} from './bun-upgrade.js';

// Mock child_process module
vi.mock('child_process', () => ({
    spawn: vi.fn(),
}));

class MockChildProcess extends EventEmitter {
    stdout = new EventEmitter();
    stderr = new EventEmitter();

    kill() {}
}

describe('bun-upgrade', () => {
    let mockProcess: MockChildProcess;
    const mockSpawn = vi.mocked(spawn);

    beforeEach(() => {
        mockProcess = new MockChildProcess();
        mockSpawn.mockReturnValue(mockProcess as any);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('parseBunOutdatedOutput', () => {
        it('should parse table output with outdated packages', () => {
            const output = `bun outdated v1.3.5
┌─────────────┬─────────┬────────┬────────┐
│ Package     │ Current │ Update │ Latest │
├─────────────┼─────────┼────────┼────────┤
│ lodash      │ 4.17.0  │ 4.17.21│ 4.17.21│
│ typescript  │ 5.0.0   │ 5.4.5  │ 5.4.5  │
└─────────────┴─────────┴────────┴────────┘`;

            const packages = parseBunOutdatedOutput(output);
            expect(packages).toEqual(['lodash', 'typescript']);
        });

        it('should return empty array when no outdated packages', () => {
            const output = 'bun outdated v1.3.5';
            const packages = parseBunOutdatedOutput(output);
            expect(packages).toEqual([]);
        });

        it('should handle empty output', () => {
            const packages = parseBunOutdatedOutput('');
            expect(packages).toEqual([]);
        });

        it('should skip header row', () => {
            const output = `│ Package     │ Current │ Update │ Latest │
│ lodash      │ 4.17.0  │ 4.17.21│ 4.17.21│`;

            const packages = parseBunOutdatedOutput(output);
            expect(packages).toEqual(['lodash']);
        });

        it('should handle packages with scoped names', () => {
            const output = `│ Package          │ Current │ Update │ Latest │
│ @types/node      │ 20.0.0  │ 22.0.0 │ 22.0.0 │
│ @vitest/ui       │ 1.0.0   │ 2.0.0  │ 2.0.0  │`;

            const packages = parseBunOutdatedOutput(output);
            expect(packages).toEqual(['@types/node', '@vitest/ui']);
        });
    });

    describe('getBunOutdatedPackages', () => {
        it('should return list of outdated packages', async () => {
            const tableOutput = `┌─────────┬─────────┬────────┬────────┐
│ Package │ Current │ Update │ Latest │
├─────────┼─────────┼────────┼────────┤
│ lodash  │ 4.17.0  │ 4.17.21│ 4.17.21│
└─────────┴─────────┴────────┴────────┘`;

            const promise = getBunOutdatedPackages();

            // Simulate bun outdated output
            mockProcess.stdout.emit('data', tableOutput);
            mockProcess.emit('close', 0);

            const result = await promise;
            expect(result).toEqual(['lodash']);
            expect(mockSpawn).toHaveBeenCalledWith('bun', ['outdated'], {
                stdio: ['ignore', 'pipe', 'pipe'],
                shell: true,
            });
        });

        it('should return empty array when all packages are up to date', async () => {
            const promise = getBunOutdatedPackages();

            mockProcess.stdout.emit('data', 'bun outdated v1.3.5');
            mockProcess.emit('close', 0);

            const result = await promise;
            expect(result).toEqual([]);
        });

        it('should reject on bun outdated failure', async () => {
            const promise = getBunOutdatedPackages();

            mockProcess.stderr.emit('data', 'bun error: something went wrong');
            mockProcess.emit('close', 1);

            await expect(promise).rejects.toThrow('bun outdated failed with code 1');
        });

        it('should reject on process error', async () => {
            const promise = getBunOutdatedPackages();

            mockProcess.emit('error', new Error('spawn failed'));

            await expect(promise).rejects.toThrow('Failed to execute bun outdated: spawn failed');
        });
    });

    describe('bunUpgradePackage', () => {
        it('should successfully upgrade a package', async () => {
            const promise = bunUpgradePackage('test-package');

            mockProcess.emit('close', 0);

            const result = await promise;
            expect(result).toEqual({
                package: 'test-package',
                success: true,
            });
            expect(mockSpawn).toHaveBeenCalledWith('bun', ['add', 'test-package@latest'], {
                stdio: ['ignore', 'inherit', 'inherit'],
                shell: true,
            });
        });

        it('should handle package upgrade failure', async () => {
            const promise = bunUpgradePackage('test-package');

            mockProcess.emit('close', 1);

            const result = await promise;
            expect(result).toEqual({
                package: 'test-package',
                success: false,
                error: 'bun add failed with exit code 1',
            });
        });

        it('should handle process error', async () => {
            const promise = bunUpgradePackage('test-package');

            mockProcess.emit('error', new Error('spawn failed'));

            const result = await promise;
            expect(result).toEqual({
                package: 'test-package',
                success: false,
                error: 'spawn failed',
            });
        });
    });

    describe('bunUpgradeAllPackages', () => {
        it('should upgrade all packages sequentially', async () => {
            const packages = ['package-a', 'package-b', 'package-c'];

            const promise = bunUpgradeAllPackages(packages);

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

            const promise = bunUpgradeAllPackages(packages);

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
            const results = await bunUpgradeAllPackages([]);
            expect(results).toEqual([]);
            expect(mockSpawn).not.toHaveBeenCalled();
        });
    });
});
