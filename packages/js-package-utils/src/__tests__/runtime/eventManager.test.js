import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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

describe("sticky events", () => {
    it("catches up an observer that subscribed after the event fired", async () => {
        const events = new EventManager();
        await events.dispatch("page_ready", { url: "/women.html" }, { sticky: true });

        const seen = [];
        events.observe("page_ready", (data) => seen.push(data.url));
        await Promise.resolve();

        expect(seen).toEqual(["/women.html"]);
    });

    it("does not replay an event that was not marked sticky", async () => {
        const events = new EventManager();
        await events.dispatch("cart_add_after", { ok: true });

        const seen = [];
        events.observe("cart_add_after", () => seen.push("late"));
        await Promise.resolve();

        expect(seen).toEqual([]);
    });

    it("hands the remembered payload to code that cannot observe", async () => {
        const events = new EventManager();

        expect(events.sticky("page_ready")).toBeUndefined();
        await events.dispatch("page_ready", { url: "/" }, { sticky: true });

        expect(events.sticky("page_ready")).toEqual({ url: "/" });
    });

    it("replays only the last payload", async () => {
        const events = new EventManager();
        await events.dispatch("page_ready", { url: "/a" }, { sticky: true });
        await events.dispatch("page_ready", { url: "/b" }, { sticky: true });

        const seen = [];
        events.observe("page_ready", (data) => seen.push(data.url));
        await Promise.resolve();

        expect(seen).toEqual(["/b"]);
    });
});

describe("observeOnce", () => {
    it("runs for the first dispatch and never again", async () => {
        const events = new EventManager();
        const seen = [];

        events.observeOnce("cart_add_after", () => seen.push("once"));
        await events.dispatch("cart_add_after", {});
        await events.dispatch("cart_add_after", {});

        expect(seen).toEqual(["once"]);
        expect(events.observersOf("cart_add_after")).toEqual([]);
    });

    it("unsubscribes cleanly when a sticky replay fires it immediately", async () => {
        const events = new EventManager();
        await events.dispatch("page_ready", { url: "/" }, { sticky: true });

        const seen = [];
        events.observeOnce("page_ready", () => seen.push("once"));
        await Promise.resolve();
        await events.dispatch("page_ready", { url: "/next" }, { sticky: true });

        expect(seen).toEqual(["once"]);
        expect(events.observersOf("page_ready")).toEqual([]);
    });
});

describe("dispatch hooks", () => {
    it("wraps every dispatch, whatever the event", async () => {
        const events = new EventManager();
        const seen = [];
        events.onDispatch({
            start: (event) => seen.push(`start:${event}`),
            end: (event) => seen.push(`end:${event}`),
        });

        await events.dispatch("cart_add_before", {});
        await events.dispatch("wishlist_add_after", {});

        expect(seen).toEqual([
            "start:cart_add_before",
            "end:cart_add_before",
            "start:wishlist_add_after",
            "end:wishlist_add_after",
        ]);
    });

    it("runs start before the observers and end after they amended the data", async () => {
        const events = new EventManager();
        const seen = [];
        events.onDispatch({
            start: (event, data) => seen.push(`start:${data.qty}`),
            end: (event, data) => seen.push(`end:${data.qty}`),
        });
        events.observe("cart_add_before", (data) => {
            data.qty = 5;
        });

        await events.dispatch("cart_add_before", { qty: 1 });

        expect(seen).toEqual(["start:1", "end:5"]);
    });

    it("passes the dispatch options through, so a hook can honour mirror opt-out", async () => {
        const events = new EventManager();
        const seen = [];
        events.onDispatch({ end: (event, data, options) => seen.push(options.mirror) });

        await events.dispatch("search_query_change", {}, { mirror: false });
        await events.dispatch("cart_add_after", {});

        expect(seen).toEqual([false, undefined]);
    });

    it("reports a hook that throws instead of failing the dispatch", async () => {
        const onError = vi.fn();
        const events = new EventManager({ onError });
        events.onDispatch({
            start: () => {
                throw new Error("tracker is broken");
            },
        });

        await expect(events.dispatch("cart_add_before", { a: 1 })).resolves.toEqual({ a: 1 });
        expect(onError).toHaveBeenCalledWith("cart_add_before", "hook:start", expect.any(Error));
    });

    it("returns an unsubscribe", async () => {
        const events = new EventManager();
        const seen = [];
        const off = events.onDispatch({ start: (event) => seen.push(event) });
        off();

        await events.dispatch("cart_add_before", {});

        expect(seen).toEqual([]);
    });
});

describe("debug", () => {
    beforeEach(() => {
        vi.spyOn(console, "debug").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("warns about an observer slow enough to cost a frame", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        let clock = 0;
        const events = new EventManager({ debug: true, now: () => clock });

        events.observe(
            "cart_add_after",
            () => {
                clock += 40;
            },
            { name: "analytics" },
        );
        events.observe("cart_add_after", () => {}, { name: "toast", sortOrder: 20 });

        await events.dispatch("cart_add_after", {});

        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0][0]).toContain('"analytics"');
        expect(warn.mock.calls[0][0]).toContain("40.0ms");
        warn.mockRestore();
    });

    it("stays quiet until it is turned on", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        let clock = 0;
        const events = new EventManager({ now: () => clock });
        events.observe("cart_add_after", () => {
            clock += 40;
        });

        await events.dispatch("cart_add_after", {});
        expect(warn).not.toHaveBeenCalled();

        events.debug();
        await events.dispatch("cart_add_after", {});
        expect(warn).toHaveBeenCalledTimes(1);

        warn.mockRestore();
    });
});
