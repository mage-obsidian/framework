// This file is part of the MageObsidian - ModernFrontend project.
//
// SPDX-FileCopyrightText: 2024 Jeanmarcos Juarez
// SPDX-License-Identifier: MIT
import { resolveConcurrency } from "#utils/buildConcurrency.ts";

describe("resolveConcurrency", () => {
    test("uses a valid override", () => {
        expect(resolveConcurrency("3", 5, 16)).toBe(3);
    });

    test("never runs more builds than there are themes", () => {
        expect(resolveConcurrency("8", 2, 16)).toBe(2);
    });

    test("falls back to one less than the cores without an override", () => {
        expect(resolveConcurrency(undefined, 10, 4)).toBe(3);
    });

    test.each(["0", "-1", "abc", "2.5", ""])("ignores the invalid override %j", (raw) => {
        expect(resolveConcurrency(raw, 10, 4)).toBe(3);
    });

    test("always allows at least one build", () => {
        expect(resolveConcurrency(undefined, 3, 1)).toBe(1);
    });
});
