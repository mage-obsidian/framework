// This file is part of the MageObsidian - ModernFrontend project.
//
// SPDX-FileCopyrightText: 2026 Jeanmarcos Juarez
// SPDX-License-Identifier: MIT
import { describe, it, expect } from "vitest";
import {
    globalKeyFor,
    PageConfig,
    publishPageConfigs,
    readPageConfig,
} from "../../runtime/pageConfig.ts";

const NAMED = /data-mage-obsidian-config="([^"]+)"/;

function pageWith(blocks, globals = {}) {
    const document = {
        queries: 0,
        querySelector(selector) {
            this.queries += 1;
            const name = selector.match(NAMED)?.[1];
            return name !== undefined && name in blocks ? { textContent: blocks[name] } : null;
        },
        querySelectorAll() {
            return Object.entries(blocks).map(([name, text]) => ({
                textContent: text,
                getAttribute: () => name,
            }));
        },
    };
    return { document, ...globals };
}

describe("globalKeyFor", () => {
    it("names, for each configuration, the global the page used to assign", () => {
        expect(Object.values(PageConfig).map(globalKeyFor)).toEqual([
            "__MAGE_OBSIDIAN_I18N__",
            "__MAGE_OBSIDIAN_ICONS__",
            "__MAGE_OBSIDIAN_PREPAINT__",
            "__MAGE_OBSIDIAN_SECTION_PREFETCH_CONFIG__",
            "__MAGE_OBSIDIAN_SECTIONS__",
            "__MAGE_OBSIDIAN_UX__",
        ]);
    });
});

describe("readPageConfig", () => {
    it("reads the data block the server emitted", () => {
        const scope = pageWith({ ux: '{"optimistic":false}' });

        expect(readPageConfig("ux", scope)).toEqual({ optimistic: false });
    });

    it("publishes what it read on the global older code still reads", () => {
        const scope = pageWith({ icons: '{"baseUrl":"/icons/"}' });

        readPageConfig("icons", scope);

        expect(scope.__MAGE_OBSIDIAN_ICONS__).toEqual({ baseUrl: "/icons/" });
    });

    it("queries the document once per name", () => {
        const scope = pageWith({ ux: '{"optimistic":false}' });

        readPageConfig("ux", scope);
        readPageConfig("ux", scope);

        expect(scope.document.queries).toBe(1);
    });

    it("falls back to the global a server from before the data blocks assigns", () => {
        const scope = pageWith({}, { __MAGE_OBSIDIAN_UX__: { optimistic: false } });

        expect(readPageConfig("ux", scope)).toEqual({ optimistic: false });
    });

    it("prefers the data block over a global", () => {
        const scope = pageWith(
            { ux: '{"optimistic":true}' },
            { __MAGE_OBSIDIAN_UX__: { optimistic: false } },
        );

        expect(readPageConfig("ux", scope)).toEqual({ optimistic: true });
    });

    it("finds nothing when the page carries neither", () => {
        expect(readPageConfig("ux", pageWith({}))).toBeUndefined();
        expect(readPageConfig("ux", {})).toBeUndefined();
        expect(readPageConfig("ux", undefined)).toBeUndefined();
    });

    it("treats a block that is not JSON as absent instead of throwing", () => {
        const scope = pageWith(
            { ux: "{optimistic:" },
            { __MAGE_OBSIDIAN_UX__: { optimistic: false } },
        );

        expect(() => readPageConfig("ux", scope)).not.toThrow();
        expect(readPageConfig("ux", scope)).toEqual({ optimistic: false });
    });
});

describe("publishPageConfigs", () => {
    it("publishes every data block on its global and names what it published", () => {
        const scope = pageWith({ i18n: '{"locale":"es_ES"}', sections: '{"lifetime":3600}' });

        expect(publishPageConfigs(scope)).toEqual(["i18n", "sections"]);
        expect(scope.__MAGE_OBSIDIAN_I18N__).toEqual({ locale: "es_ES" });
        expect(scope.__MAGE_OBSIDIAN_SECTIONS__).toEqual({ lifetime: 3600 });
    });

    it("skips a block that is not JSON and keeps going", () => {
        const scope = pageWith({ ux: "nope", icons: '{"baseUrl":"/icons/"}' });

        expect(() => publishPageConfigs(scope)).not.toThrow();
        expect(publishPageConfigs(scope)).toEqual(["icons"]);
        expect(scope.__MAGE_OBSIDIAN_UX__).toBeUndefined();
    });

    it("does nothing without a document", () => {
        expect(publishPageConfigs({})).toEqual([]);
        expect(publishPageConfigs(undefined)).toEqual([]);
    });
});
