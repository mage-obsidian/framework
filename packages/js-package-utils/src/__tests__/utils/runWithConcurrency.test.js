import runWithConcurrency from "../../utils/runWithConcurrency.ts";

const tick = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe("runWithConcurrency", () => {
    it("returns results in input order regardless of completion order", async () => {
        const items = [30, 10, 20, 5];
        const results = await runWithConcurrency(
            items,
            async (ms, i) => {
                await tick(ms);
                return `${i}:${ms}`;
            },
            2,
        );
        expect(results).toEqual(["0:30", "1:10", "2:20", "3:5"]);
    });

    it("never exceeds the concurrency limit", async () => {
        let active = 0;
        let peak = 0;
        const items = Array.from({ length: 8 }, (_, i) => i);
        await runWithConcurrency(
            items,
            async () => {
                active++;
                peak = Math.max(peak, active);
                await tick(5);
                active--;
            },
            3,
        );
        expect(peak).toBeLessThanOrEqual(3);
        expect(peak).toBeGreaterThan(1);
    });

    it("passes the index to the worker", async () => {
        const seen = [];
        await runWithConcurrency(
            ["a", "b", "c"],
            async (item, index) => {
                seen.push([item, index]);
            },
            1,
        );
        expect(seen).toEqual([
            ["a", 0],
            ["b", 1],
            ["c", 2],
        ]);
    });

    it("propagates the first rejection", async () => {
        await expect(
            runWithConcurrency(
                [1, 2, 3],
                async (n) => {
                    if (n === 2) throw new Error("boom");
                    return n;
                },
                2,
            ),
        ).rejects.toThrow("boom");
    });

    it("handles an empty list", async () => {
        const results = await runWithConcurrency([], async () => 1, 4);
        expect(results).toEqual([]);
    });

    it("validates its arguments", async () => {
        await expect(runWithConcurrency("nope", () => {})).rejects.toThrow(TypeError);
        await expect(runWithConcurrency([], "nope")).rejects.toThrow(TypeError);
    });
});
