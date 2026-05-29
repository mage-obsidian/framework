import {
    parseSectionStorage,
    selectSection,
    mergeSections,
    isSectionStale,
    buildSectionLoadUrl,
    readCookie,
    needsHydration,
    expiredSectionNames,
    readSectionRuntimeConfig,
} from "../../runtime/sectionStoreCore.ts";

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
    const ENDPOINT = "customer/section/load/";

    it("joins section names and defaults force flag to false", () => {
        expect(buildSectionLoadUrl(ENDPOINT, ["cart", "customer"])).toBe(
            "/customer/section/load/?sections=cart,customer&force_new_section_timestamp=false"
        );
    });

    it("omits the sections param for an empty list (server returns all; rejects sections=*)", () => {
        expect(buildSectionLoadUrl(ENDPOINT, [])).toBe(
            "/customer/section/load/?force_new_section_timestamp=false"
        );
    });

    it("honors a custom base URL and the force flag", () => {
        expect(
            buildSectionLoadUrl(ENDPOINT, ["cart"], { baseUrl: "https://shop.test", forceNewTimestamp: true })
        ).toBe("https://shop.test/customer/section/load/?sections=cart&force_new_section_timestamp=true");
    });

    it("tolerates a leading slash in the endpoint", () => {
        expect(buildSectionLoadUrl("/customer/section/load/", ["cart"])).toBe(
            "/customer/section/load/?sections=cart&force_new_section_timestamp=false"
        );
    });
});

describe("readCookie", () => {
    it("reads a cookie value by name", () => {
        expect(readCookie("form_key=abc; private_content_version=v1", "private_content_version")).toBe("v1");
    });

    it("trims surrounding whitespace and decodes the value", () => {
        expect(readCookie("a=1; b=%20x%20", "b")).toBe(" x ");
    });

    it("returns empty string when absent or input is missing", () => {
        expect(readCookie("a=1", "missing")).toBe("");
        expect(readCookie("", "a")).toBe("");
        expect(readCookie(null, "a")).toBe("");
    });
});

describe("needsHydration", () => {
    it("hydrates when nothing is cached yet", () => {
        expect(needsHydration({}, "v1", "v1")).toBe(true);
        expect(needsHydration(null, "", "v1")).toBe(true);
    });

    it("hydrates when the version cookie moved past the synced version", () => {
        expect(needsHydration({ cart: {} }, "v1", "v2")).toBe(true);
    });

    it("does not hydrate when the cached version still matches", () => {
        expect(needsHydration({ cart: {} }, "v2", "v2")).toBe(false);
    });

    it("does not hydrate when there is no version cookie to compare", () => {
        expect(needsHydration({ cart: {} }, "v1", "")).toBe(false);
    });
});

describe("expiredSectionNames", () => {
    const now = 1000;

    it("flags a present, expirable section whose data_id + lifetime has passed", () => {
        const sections = { cart: { summary_count: 6, data_id: 900 } };
        expect(expiredSectionNames(sections, 60, ["cart"], now)).toEqual(["cart"]);
    });

    it("does not flag a section still within its lifetime", () => {
        const sections = { cart: { summary_count: 6, data_id: 960 } };
        expect(expiredSectionNames(sections, 60, ["cart"], now)).toEqual([]);
    });

    it("ignores sections absent from storage (mirrors native lifetime branch)", () => {
        expect(expiredSectionNames({ customer: { data_id: 1 } }, 60, ["cart"], now)).toEqual([]);
    });

    it("ignores sections not in the expirable list", () => {
        const sections = { customer: { data_id: 1 } };
        expect(expiredSectionNames(sections, 60, ["cart"], now)).toEqual([]);
    });

    it("returns [] when no lifetime, no expirable names, or no sections", () => {
        const sections = { cart: { data_id: 1 } };
        expect(expiredSectionNames(sections, 0, ["cart"], now)).toEqual([]);
        expect(expiredSectionNames(sections, 60, [], now)).toEqual([]);
        expect(expiredSectionNames(null, 60, ["cart"], now)).toEqual([]);
    });
});

describe("readSectionRuntimeConfig", () => {
    it("reads the lifetime (seconds) and expirable names from the scope global", () => {
        const scope = { __MAGE_OBSIDIAN_SECTIONS__: { lifetime: 3600, expirable: ["cart"] } };
        expect(readSectionRuntimeConfig(scope)).toEqual({
            lifetimeSeconds: 3600,
            expirableSections: ["cart"],
        });
    });

    it("falls back to a disabled config (lifetime 0, no sections) when the global is absent", () => {
        expect(readSectionRuntimeConfig({})).toEqual({ lifetimeSeconds: 0, expirableSections: [] });
        expect(readSectionRuntimeConfig(undefined)).toEqual({ lifetimeSeconds: 0, expirableSections: [] });
    });

    it("coerces a non-positive or non-numeric lifetime to 0 and keeps only string section names", () => {
        const scope = { __MAGE_OBSIDIAN_SECTIONS__: { lifetime: "x", expirable: ["cart", 5, null] } };
        expect(readSectionRuntimeConfig(scope)).toEqual({ lifetimeSeconds: 0, expirableSections: ["cart"] });
    });
});
