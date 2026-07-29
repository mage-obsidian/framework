import { describe, it, expect } from "vitest";
import { readUxRuntimeConfig } from "../../runtime/uxConfig.ts";

describe("readUxRuntimeConfig", () => {
    it("reads what the page published", () => {
        expect(
            readUxRuntimeConfig({
                __MAGE_OBSIDIAN_UX__: { optimistic: false, summaryCountsQty: false },
            }),
        ).toEqual({ optimistic: false, summaryCountsQty: false });
    });

    it("defaults to optimistic when the page published nothing", () => {
        expect(readUxRuntimeConfig({})).toEqual({ optimistic: true, summaryCountsQty: true });
        expect(readUxRuntimeConfig(undefined)).toEqual({ optimistic: true, summaryCountsQty: true });
    });

    it("ignores a non-boolean rather than coercing it", () => {
        expect(readUxRuntimeConfig({ __MAGE_OBSIDIAN_UX__: { optimistic: "0" } })).toEqual({
            optimistic: true,
            summaryCountsQty: true,
        });
        expect(readUxRuntimeConfig({ __MAGE_OBSIDIAN_UX__: null })).toEqual({
            optimistic: true,
            summaryCountsQty: true,
        });
    });
});
