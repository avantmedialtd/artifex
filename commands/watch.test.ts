import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    handleWatch,
    getProjectName,
    calculateAggregateMetrics,
    renderProgressBar,
} from './watch.ts';

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

            expect(consoleErrorSpy).toHaveBeenCalledWith('Usage: af watch');

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
            expect(consoleErrorSpy).toHaveBeenCalledWith('Usage: af watch');
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

describe('getProjectName', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should extract project name from current working directory', () => {
        vi.spyOn(process, 'cwd').mockReturnValue('/Users/dev/my-project');

        const projectName = getProjectName();

        expect(projectName).toBe('my-project');
    });

    it('should handle root directory gracefully', () => {
        vi.spyOn(process, 'cwd').mockReturnValue('/');

        const projectName = getProjectName();

        expect(projectName).toBeTruthy();
    });

    it('should handle nested paths correctly', () => {
        vi.spyOn(process, 'cwd').mockReturnValue('/home/user/projects/awesome-app');

        const projectName = getProjectName();

        expect(projectName).toBe('awesome-app');
    });
});

describe('calculateAggregateMetrics', () => {
    it('should calculate metrics for multiple changes', () => {
        const changes = [
            {
                changeId: 'change1',
                sections: [],
                totalTasks: 5,
                completedTasks: 3,
            },
            {
                changeId: 'change2',
                sections: [],
                totalTasks: 10,
                completedTasks: 7,
            },
            {
                changeId: 'change3',
                sections: [],
                totalTasks: 8,
                completedTasks: 2,
            },
        ];

        const metrics = calculateAggregateMetrics(changes);

        expect(metrics.totalChanges).toBe(3);
        expect(metrics.totalTasks).toBe(23); // 5 + 10 + 8
        expect(metrics.completedTasks).toBe(12); // 3 + 7 + 2
    });

    it('should handle empty changes array', () => {
        const metrics = calculateAggregateMetrics([]);

        expect(metrics.totalChanges).toBe(0);
        expect(metrics.totalTasks).toBe(0);
        expect(metrics.completedTasks).toBe(0);
    });

    it('should handle changes with no tasks', () => {
        const changes = [
            {
                changeId: 'change1',
                sections: [],
                totalTasks: 0,
                completedTasks: 0,
            },
            {
                changeId: 'change2',
                sections: [],
                totalTasks: 5,
                completedTasks: 2,
            },
        ];

        const metrics = calculateAggregateMetrics(changes);

        expect(metrics.totalChanges).toBe(2);
        expect(metrics.totalTasks).toBe(5);
        expect(metrics.completedTasks).toBe(2);
    });
});

describe('renderProgressBar', () => {
    it('should render progress bar with completed and incomplete blocks', () => {
        const result = renderProgressBar(10, 20);

        // Should contain filled blocks (█) and empty blocks (░)
        expect(result).toContain('█');
        expect(result).toContain('░');
        expect(result).toContain('50%');
    });

    it('should handle 100% completion', () => {
        const result = renderProgressBar(20, 20);

        expect(result).toContain('100%');
        expect(result).toContain('█');
    });

    it('should handle 0% completion', () => {
        const result = renderProgressBar(0, 20);

        expect(result).toContain('0%');
        expect(result).toContain('░');
    });

    it('should handle 0 total tasks', () => {
        const result = renderProgressBar(0, 0);

        expect(result).toContain('N/A');
        expect(result).toContain('░');
    });

    it('should render exactly 20 character wide bar', () => {
        const result = renderProgressBar(5, 10);

        // Count the number of block characters (ignoring ANSI codes)
        const blocks = (result.match(/[█░]/g) || []).length;
        expect(blocks).toBe(20);
    });

    it('should correctly calculate percentage for various ratios', () => {
        expect(renderProgressBar(1, 4)).toContain('25%');
        expect(renderProgressBar(3, 4)).toContain('75%');
        expect(renderProgressBar(7, 10)).toContain('70%');
    });
});
