// This file is part of the MageObsidian - ModernFrontend project.
//
// SPDX-FileCopyrightText: 2024 Jeanmarcos Juarez
// SPDX-License-Identifier: MIT
import { describe, it, expect } from "vitest";
import { readUxRuntimeConfig } from "../../runtime/uxConfig.ts";

function pageWithBlock(name, json) {
    return {
        document: {
            querySelector: (selector) =>
                selector.includes(`data-mage-obsidian-config="${name}"`)
                    ? { textContent: json }
                    : null,
            querySelectorAll: () => [],
        },
    };
}

describe("readUxRuntimeConfig", () => {
    it("reads the data block the server emitted", () => {
        expect(
            readUxRuntimeConfig(
                pageWithBlock("ux", '{"optimistic":false,"summaryCountsQty":false}'),
            ),
        ).toEqual({
            optimistic: false,
            summaryCountsQty: false,
        });
    });

    it("reads what the page published", () => {
        expect(
            readUxRuntimeConfig({
                __MAGE_OBSIDIAN_UX__: { optimistic: false, summaryCountsQty: false },
            }),
        ).toEqual({ optimistic: false, summaryCountsQty: false });
    });

    it("defaults to optimistic when the page published nothing", () => {
        expect(readUxRuntimeConfig({})).toEqual({ optimistic: true, summaryCountsQty: true });
        expect(readUxRuntimeConfig(undefined)).toEqual({
            optimistic: true,
            summaryCountsQty: true,
        });
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
