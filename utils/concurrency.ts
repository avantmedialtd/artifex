/**
 * Map `items` through `fn` with at most `concurrency` calls in flight,
 * preserving input order. Stops starting new calls after the first rejection.
 */
export async function mapWithConcurrency<T, R>(
    items: readonly T[],
    concurrency: number,
    fn: (item: T) => Promise<R>,
): Promise<R[]> {
    const results: R[] = [];
    let next = 0;
    let failed = false;
    async function worker(): Promise<void> {
        while (!failed && next < items.length) {
            const i = next++;
            try {
                results[i] = await fn(items[i] as T);
            } catch (err) {
                failed = true;
                throw err;
            }
        }
    }
    const workers = Math.min(concurrency, items.length);
    await Promise.all(Array.from({ length: workers }, worker));
    return results;
}
