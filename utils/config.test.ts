import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { loadAfConfig, getStopHookConfig } from './config.ts';

vi.mock('node:fs', () => ({
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
}));

describe('config utilities', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('loadAfConfig', () => {
        it('should return undefined when af.json does not exist', () => {
            vi.mocked(existsSync).mockReturnValue(false);

            const result = loadAfConfig();

            expect(result).toBeUndefined();
            expect(readFileSync).not.toHaveBeenCalled();
        });

        it('should parse and return af.json contents when file exists', () => {
            vi.mocked(existsSync).mockReturnValue(true);
            vi.mocked(readFileSync).mockReturnValue(
                JSON.stringify({
                    stopHook: {
                        ignoredPaths: ['docs/', 'test/'],
                        command: 'npm test',
                    },
                }),
            );

            const result = loadAfConfig();

            expect(result).toEqual({
                stopHook: {
                    ignoredPaths: ['docs/', 'test/'],
                    command: 'npm test',
                },
            });
        });

        it('should throw when af.json contains invalid JSON', () => {
            vi.mocked(existsSync).mockReturnValue(true);
            vi.mocked(readFileSync).mockReturnValue('not valid json');

            expect(() => loadAfConfig()).toThrow();
        });
    });

    describe('getStopHookConfig', () => {
        it('should return defaults when af.json does not exist', () => {
            vi.mocked(existsSync).mockReturnValue(false);

            const config = getStopHookConfig();

            expect(config).toEqual({
                ignoredPaths: ['openspec/'],
                command: 'af e2e',
            });
        });

        it('should return defaults when af.json has no stopHook section', () => {
            vi.mocked(existsSync).mockReturnValue(true);
            vi.mocked(readFileSync).mockReturnValue(JSON.stringify({}));

            const config = getStopHookConfig();

            expect(config).toEqual({
                ignoredPaths: ['openspec/'],
                command: 'af e2e',
            });
        });

        it('should override ignoredPaths completely when specified', () => {
            vi.mocked(existsSync).mockReturnValue(true);
            vi.mocked(readFileSync).mockReturnValue(
                JSON.stringify({
                    stopHook: {
                        ignoredPaths: ['docs/', 'scripts/'],
                    },
                }),
            );

            const config = getStopHookConfig();

            expect(config.ignoredPaths).toEqual(['docs/', 'scripts/']);
            expect(config.command).toBe('af e2e'); // default
        });

        it('should override command when specified', () => {
            vi.mocked(existsSync).mockReturnValue(true);
            vi.mocked(readFileSync).mockReturnValue(
                JSON.stringify({
                    stopHook: {
                        command: 'npm run test:e2e',
                    },
                }),
            );

            const config = getStopHookConfig();

            expect(config.ignoredPaths).toEqual(['openspec/']); // default
            expect(config.command).toBe('npm run test:e2e');
        });

        it('should use all custom values when fully specified', () => {
            vi.mocked(existsSync).mockReturnValue(true);
            vi.mocked(readFileSync).mockReturnValue(
                JSON.stringify({
                    stopHook: {
                        ignoredPaths: ['openspec/', 'docs/', 'apps/chrome-extension/'],
                        command: 'bun test:e2e',
                    },
                }),
            );

            const config = getStopHookConfig();

            expect(config).toEqual({
                ignoredPaths: ['openspec/', 'docs/', 'apps/chrome-extension/'],
                command: 'bun test:e2e',
            });
        });
    });
});
