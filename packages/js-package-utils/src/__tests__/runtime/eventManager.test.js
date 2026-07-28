import { describe, it, expect, vi } from "vitest";
import { EventManager } from "../../runtime/eventManager.ts";

describe("EventManager", () => {
    it("notifies observers in sortOrder, not registration order", async () => {
        const seen = [];
        const events = new EventManager();

        events.observe("cart_add_after", () => seen.push("late"), { sortOrder: 30 });
        events.observe("cart_add_after", () => seen.push("early"), { sortOrder: 5 });

        await events.dispatch("cart_add_after", {});

        expect(seen).toEqual(["early", "late"]);
    });

    it("lets an observer amend the data the dispatcher reads back", async () => {
        const events = new EventManager();
        events.observe("cart_add_before", (data) => {
            data.qty = 5;
        });

        const result = await events.dispatch("cart_add_before", { qty: 1 });

        expect(result.qty).toBe(5);
    });

    it("awaits an async observer before moving on", async () => {
        const seen = [];
        const events = new EventManager();

        events.observe("cart_add_after", async () => {
            await Promise.resolve();
            seen.push("slow");
        });
        events.observe("cart_add_after", () => seen.push("fast"), { sortOrder: 20 });

        await events.dispatch("cart_add_after", {});

        expect(seen).toEqual(["slow", "fast"]);
    });

    it("skips an observer that throws and keeps going", async () => {
        const onError = vi.fn();
        const seen = [];
        const events = new EventManager({ onError });

        events.observe(
            "cart_add_after",
            () => {
                throw new Error("analytics is down");
            },
            { name: "analytics" },
        );
        events.observe("cart_add_after", () => seen.push("toast"), { sortOrder: 20 });

        await events.dispatch("cart_add_after", {});

        expect(seen).toEqual(["toast"]);
        expect(onError).toHaveBeenCalledWith("cart_add_after", "analytics", expect.any(Error));
    });

    it("skips an async observer that rejects", async () => {
        const onError = vi.fn();
        const events = new EventManager({ onError });
        events.observe("cart_add_after", async () => {
            throw new Error("nope");
        });

        await expect(events.dispatch("cart_add_after", {})).resolves.toEqual({});
        expect(onError).toHaveBeenCalled();
    });

    it("dispatching an event nobody listens to is a no-op", async () => {
        const events = new EventManager();

        await expect(events.dispatch("nothing_listens", { a: 1 })).resolves.toEqual({ a: 1 });
    });

    it("returns an unsubscribe that removes only that observer", async () => {
        const seen = [];
        const events = new EventManager();

        const off = events.observe("cart_add_after", () => seen.push("first"));
        events.observe("cart_add_after", () => seen.push("second"), { sortOrder: 20 });
        off();

        await events.dispatch("cart_add_after", {});

        expect(seen).toEqual(["second"]);
        expect(events.observersOf("cart_add_after")).toHaveLength(1);
    });

    it("names an unnamed observer so the error report can identify it", () => {
        const events = new EventManager();

        events.observe("cart_add_after", () => {});
        events.observe("cart_add_after", () => {}, { name: "analytics" });

        expect(events.observersOf("cart_add_after")).toEqual(["cart_add_after_1", "analytics"]);
    });

    it("survives an observer unsubscribing during dispatch", async () => {
        const seen = [];
        const events = new EventManager();

        const off = events.observe("cart_add_after", () => {
            seen.push("first");
            off();
        });
        events.observe("cart_add_after", () => seen.push("second"), { sortOrder: 20 });

        await events.dispatch("cart_add_after", {});

        expect(seen).toEqual(["first", "second"]);
    });
});
