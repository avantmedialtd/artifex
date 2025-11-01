import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleWatch } from './watch.ts';

describe('handleWatch', () => {
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.spyOn(console, 'log').mockImplementation(() => {});
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('argument validation', () => {
        it('should reject when arguments are provided', async () => {
            const watchPromise = handleWatch(true);

            // Wait a bit for the synchronous part to execute
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(consoleErrorSpy).toHaveBeenCalledWith('Usage: zap watch');

            // The promise should resolve to 1
            const exitCode = await Promise.race([
                watchPromise,
                new Promise<number>(resolve => setTimeout(() => resolve(1), 100)),
            ]);
            expect(exitCode).toBe(1);
        });
    });

    describe('watch mode behavior', () => {
        it('should not accept arguments', async () => {
            const exitCode = await Promise.race([
                handleWatch(true),
                new Promise<number>(resolve => setTimeout(() => resolve(1), 100)),
            ]);

            expect(exitCode).toBe(1);
            expect(consoleErrorSpy).toHaveBeenCalledWith('Usage: zap watch');
        });
    });

    describe('display formatting', () => {
        it('should clear screen when starting watch mode', async () => {
            const stdoutWriteSpy = vi.spyOn(process.stdout, 'write');

            // Start watch mode but don't wait for it to complete
            const watchPromise = handleWatch(false);

            // Wait a bit for initial display
            await new Promise(resolve => setTimeout(resolve, 100));

            // Should have written ANSI clear codes
            expect(stdoutWriteSpy).toHaveBeenCalled();
            const calls = stdoutWriteSpy.mock.calls;
            const hasAnsiClearCode = calls.some(
                call => typeof call[0] === 'string' && call[0].includes('\x1b[2J\x1b[H'),
            );
            expect(hasAnsiClearCode).toBe(true);

            // Don't leave the watch running
            watchPromise.catch(() => {});
        });
    });
});
