// This file is part of the MageObsidian - ModernFrontend project.
//
// SPDX-FileCopyrightText: 2024 Jeanmarcos Juarez
// SPDX-License-Identifier: MIT
import { withAbsoluteSources } from "#core/contractPaths.ts";

describe("withAbsoluteSources", () => {
    test("resolves relative module and theme sources against the root", () => {
        const contract = {
            schema_version: "1.1.0",
            modules: { Acme_Mod: { src: "vendor/acme/mod", universal: true } },
            themes: { "Acme/shop": { src: "app/design/frontend/Acme/shop", parent: null } },
            LIB_PATH: "lib",
        };

        expect(withAbsoluteSources(contract, "/srv/app")).toEqual({
            schema_version: "1.1.0",
            modules: { Acme_Mod: { src: "/srv/app/vendor/acme/mod", universal: true } },
            themes: {
                "Acme/shop": { src: "/srv/app/app/design/frontend/Acme/shop", parent: null },
            },
            LIB_PATH: "lib",
        });
    });

    test("keeps absolute sources, so a 1.0.0 contract reads unchanged", () => {
        const contract = { modules: { Acme_Mod: { src: "/old/root/mod" } }, themes: {} };

        expect(withAbsoluteSources(contract, "/srv/app")).toEqual(contract);
    });

    test("leaves an entry without a string src for the validator to judge", () => {
        const contract = { modules: { Broken: {}, Odd: { src: 42 } }, themes: {} };

        expect(withAbsoluteSources(contract, "/srv/app")).toEqual(contract);
    });

    test("does not mutate the contract it was given", () => {
        const contract = { modules: { Acme_Mod: { src: "vendor/acme/mod" } }, themes: {} };

        withAbsoluteSources(contract, "/srv/app");

        expect(contract.modules.Acme_Mod.src).toBe("vendor/acme/mod");
    });
});
