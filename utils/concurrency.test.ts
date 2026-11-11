import { describe, it, expect } from 'vitest';
import { mapWithConcurrency } from './concurrency.ts';

/** A promise and the function that resolves it. */
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(r => {
        resolve = r;
    });
    return { promise, resolve };
}

/** Lets every pending promise callback run. */
function settle(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 0));
}

describe('mapWithConcurrency', () => {
    it('keeps at most N calls in flight', async () => {
        const pending: Array<() => void> = [];
        let inFlight = 0;
        let maxInFlight = 0;
        const run = mapWithConcurrency([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 3, item => {
            inFlight++;
            maxInFlight = Math.max(maxInFlight, inFlight);
            const call = deferred<number>();
            pending.push(() => {
                inFlight--;
                call.resolve(item * 10);
            });
            return call.promise;
        });

        let done = false;
        const finished = run.then(results => {
            done = true;
            return results;
        });
        while (!done) {
            await settle();
            expect(inFlight).toBeLessThanOrEqual(3);
            pending.shift()?.();
        }

        expect(await finished).toEqual([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
        expect(maxInFlight).toBe(3);
    });

    it('returns the results in input order, whatever order the calls finish in', async () => {
        const calls = new Map<number, (value: string) => void>();
        const run = mapWithConcurrency([1, 2, 3, 4], 4, item => {
            const call = deferred<string>();
            calls.set(item, call.resolve);
            return call.promise;
        });

        await settle();
        for (const item of [4, 2, 3, 1]) {
            calls.get(item)?.(`result ${item}`);
            await settle();
        }

        expect(await run).toEqual(['result 1', 'result 2', 'result 3', 'result 4']);
    });

    it('starts no new call after a rejection', async () => {
        const started: number[] = [];
        const second = deferred<number>();
        const run = mapWithConcurrency([0, 1, 2, 3, 4], 2, item => {
            started.push(item);
            if (item === 0) return Promise.reject(new Error('boom'));
            if (item === 1) return second.promise;
            return Promise.resolve(item);
        });

        await expect(run).rejects.toThrow('boom');
        // The call still in flight finishes, and its worker then stops.
        second.resolve(1);
        await settle();
        expect(started).toEqual([0, 1]);
    });

    it('makes no call for an empty list', async () => {
        let calls = 0;
        const results = await mapWithConcurrency([], 4, async () => {
            calls++;
        });
        expect(results).toEqual([]);
        expect(calls).toBe(0);
    });
});
