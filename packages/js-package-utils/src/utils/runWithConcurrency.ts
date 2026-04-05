/**
 * Run async workers over a list of items with a bounded number running at once.
 *
 * Results are returned in the same order as `items` regardless of completion
 * order. The first rejection aborts the run (no new workers are started) and is
 * propagated, mirroring Promise.all semantics. `limit` defaults to the number of
 * items.
 */
export default async function runWithConcurrency<T, R>(
    items: T[],
    worker: (item: T, index: number) => Promise<R>,
    limit: number = items.length,
): Promise<R[]> {
    if (!Array.isArray(items)) {
        throw new TypeError("runWithConcurrency: items must be an array.");
    }
    if (typeof worker !== "function") {
        throw new TypeError("runWithConcurrency: worker must be a function.");
    }

    const effectiveLimit = Math.max(1, Math.min(limit, items.length || 1));
    const results = Array.from({ length: items.length }) as R[];
    let nextIndex = 0;

    async function runner() {
        while (nextIndex < items.length) {
            const current = nextIndex++;
            results[current] = await worker(items[current], current);
        }
    }

    const runners = Array.from({ length: Math.min(effectiveLimit, items.length) }, runner);
    await Promise.all(runners);
    return results;
}
