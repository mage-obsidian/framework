import { describe, it, expect, vi } from "vitest";
import { createActivityTracker, matchActivity } from "../../runtime/activity.ts";

describe("matchActivity", () => {
    it("opens the domain and the operation on a _before", () => {
        expect(matchActivity("cart_add_before")).toEqual({
            phase: "begin",
            scopes: ["cart", "cart_add"],
        });
        expect(matchActivity("cart_update_qty_before")).toEqual({
            phase: "begin",
            scopes: ["cart", "cart_update_qty"],
        });
    });

    it("closes them on _after and on _failed", () => {
        expect(matchActivity("wishlist_remove_after")).toEqual({
            phase: "end",
            scopes: ["wishlist", "wishlist_remove"],
        });
        expect(matchActivity("wishlist_remove_failed")).toEqual({
            phase: "end",
            scopes: ["wishlist", "wishlist_remove"],
        });
    });

    it("collapses a single-segment operation to one scope", () => {
        expect(matchActivity("navigation_before")).toEqual({
            phase: "begin",
            scopes: ["navigation"],
        });
    });

    it("ignores an event that announces a fact rather than a round trip", () => {
        expect(matchActivity("product_variant_change")).toBeNull();
        expect(matchActivity("page_ready")).toBeNull();
        expect(matchActivity("_before")).toBeNull();
    });
});

describe("ActivityTracker", () => {
    const noTimer = () => () => {};

    it("is busy from the first begin until the last end", () => {
        const tracker = createActivityTracker({ schedule: noTimer });

        expect(tracker.isBusy("cart")).toBe(false);
        tracker.begin("cart");
        tracker.begin("cart");
        expect(tracker.pending("cart")).toBe(2);

        tracker.end("cart");
        expect(tracker.isBusy("cart")).toBe(true);
        tracker.end("cart");
        expect(tracker.isBusy("cart")).toBe(false);
    });

    it("clamps at zero, because a failed mutation announces both _after and _failed", () => {
        const tracker = createActivityTracker({ schedule: noTimer });
        tracker.begin("cart");
        tracker.end("cart");
        tracker.end("cart");

        expect(tracker.pending("cart")).toBe(0);
    });

    it("reports every change, so a reactive wrapper can mirror it", () => {
        const onChange = vi.fn();
        const tracker = createActivityTracker({ onChange, schedule: noTimer });

        tracker.begin("cart");
        tracker.end("cart");
        tracker.end("cart");

        expect(onChange.mock.calls).toEqual([
            ["cart", 1],
            ["cart", 0],
        ]);
    });

    it("lists what is in flight", () => {
        const tracker = createActivityTracker({ schedule: noTimer });
        tracker.begin("cart");
        tracker.begin("wishlist");
        tracker.end("wishlist");

        expect(tracker.busyScopes()).toEqual(["cart"]);
    });

    it("force-closes a scope whose flow never announced its end", () => {
        let fire = () => {};
        const onStuck = vi.fn();
        const onChange = vi.fn();
        const tracker = createActivityTracker({
            onStuck,
            onChange,
            timeoutMs: 15000,
            schedule: (callback) => {
                fire = callback;
                return () => {};
            },
        });

        tracker.begin("cart");
        fire();

        expect(tracker.isBusy("cart")).toBe(false);
        expect(onStuck).toHaveBeenCalledWith("cart");
        expect(onChange).toHaveBeenLastCalledWith("cart", 0);
    });

    it("cancels the backstop once the scope closes on its own", () => {
        const cancel = vi.fn();
        const tracker = createActivityTracker({ schedule: () => cancel });

        tracker.begin("cart");
        tracker.end("cart");

        expect(cancel).toHaveBeenCalledOnce();
    });

    it("arms the backstop once per scope, not once per operation", () => {
        const schedule = vi.fn(() => () => {});
        const tracker = createActivityTracker({ schedule });

        tracker.begin("cart");
        tracker.begin("cart");

        expect(schedule).toHaveBeenCalledOnce();
    });
});
