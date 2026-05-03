import {
    parseSectionStorage,
    selectSection,
    mergeSections,
    isSectionStale,
    buildSectionLoadUrl,
} from "../../runtime/customerDataCore.ts";

describe("parseSectionStorage", () => {
    it("parses sections keyed by name", () => {
        const raw = JSON.stringify({
            cart: { summary_count: 2, data_id: 100 },
            customer: { firstname: "Ada" },
        });
        expect(parseSectionStorage(raw)).toEqual({
            cart: { summary_count: 2, data_id: 100 },
            customer: { firstname: "Ada" },
        });
    });

    it("returns {} for null, empty or non-string input", () => {
        expect(parseSectionStorage(null)).toEqual({});
        expect(parseSectionStorage("")).toEqual({});
        expect(parseSectionStorage(undefined)).toEqual({});
    });

    it("returns {} for malformed JSON", () => {
        expect(parseSectionStorage("{not json")).toEqual({});
    });

    it("returns {} when the payload is not a plain object", () => {
        expect(parseSectionStorage(JSON.stringify([1, 2]))).toEqual({});
        expect(parseSectionStorage(JSON.stringify("x"))).toEqual({});
    });

    it("drops non-object section values", () => {
        const raw = JSON.stringify({ cart: { ok: 1 }, junk: 5, list: [1] });
        expect(parseSectionStorage(raw)).toEqual({ cart: { ok: 1 } });
    });
});

describe("selectSection", () => {
    const sections = { cart: { summary_count: 3 } };

    it("returns the section when present", () => {
        expect(selectSection(sections, "cart")).toEqual({ summary_count: 3 });
    });

    it("returns null when absent", () => {
        expect(selectSection(sections, "wishlist")).toBeNull();
    });

    it("returns null for a null/invalid map", () => {
        expect(selectSection(null, "cart")).toBeNull();
    });
});

describe("mergeSections", () => {
    it("overlays incoming sections onto the current map", () => {
        const current = { cart: { summary_count: 1 }, customer: { firstname: "Ada" } };
        const incoming = { cart: { summary_count: 4 } };
        expect(mergeSections(current, incoming)).toEqual({
            cart: { summary_count: 4 },
            customer: { firstname: "Ada" },
        });
    });

    it("ignores non-object incoming values and tolerates nulls", () => {
        expect(mergeSections({ cart: { x: 1 } }, null)).toEqual({ cart: { x: 1 } });
        expect(mergeSections(null, { cart: { x: 1 } })).toEqual({ cart: { x: 1 } });
        expect(mergeSections({ a: { x: 1 } }, { b: 5 })).toEqual({ a: { x: 1 } });
    });
});

describe("isSectionStale", () => {
    it("treats a missing section as stale", () => {
        expect(isSectionStale(null, 60, 1000)).toBe(true);
    });

    it("never expires a section without a positive data_id (client-side section)", () => {
        expect(isSectionStale({ count: 0 }, 60, 1_000_000)).toBe(false);
        expect(isSectionStale({ data_id: 0 }, 60, 1_000_000)).toBe(false);
    });

    it("never expires when lifetime is not positive", () => {
        expect(isSectionStale({ data_id: 100 }, 0, 1_000_000)).toBe(false);
    });

    it("is stale once data_id + lifetime has passed", () => {
        expect(isSectionStale({ data_id: 100 }, 60, 161)).toBe(true);
        expect(isSectionStale({ data_id: 100 }, 60, 159)).toBe(false);
    });
});

describe("buildSectionLoadUrl", () => {
    it("joins section names and defaults force flag to false", () => {
        expect(buildSectionLoadUrl(["cart", "customer"])).toBe(
            "/customer/section/load/?sections=cart,customer&force_new_section_timestamp=false"
        );
    });

    it("requests all sections (*) for an empty list", () => {
        expect(buildSectionLoadUrl([])).toBe(
            "/customer/section/load/?sections=*&force_new_section_timestamp=false"
        );
    });

    it("honors a custom base URL and the force flag", () => {
        expect(buildSectionLoadUrl(["cart"], { baseUrl: "https://shop.test", forceNewTimestamp: true })).toBe(
            "https://shop.test/customer/section/load/?sections=cart&force_new_section_timestamp=true"
        );
    });
});
