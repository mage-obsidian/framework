import { vi } from "vitest";

async function chainWith(themes) {
    vi.resetModules();
    vi.doMock("#core/configResolver.ts", () => ({
        default: { getMagentoConfig: () => ({ themes }) },
        getMagentoConfig: () => ({ themes }),
    }));
    return import("#core/themeChain.ts");
}

describe("getThemeChain", () => {
    test("walks from the theme up to the root", async () => {
        const { getThemeChain } = await chainWith({
            "V/leaf": { src: "/leaf", parent: "V/mid" },
            "V/mid": { src: "/mid", parent: "V/root" },
            "V/root": { src: "/root" },
        });

        expect(getThemeChain("V/leaf")).toEqual(["V/leaf", "V/mid", "V/root"]);
    });

    test("is a single entry for a theme with no parent", async () => {
        const { getThemeChain } = await chainWith({ "V/root": { src: "/root" } });

        expect(getThemeChain("V/root")).toEqual(["V/root"]);
    });

    test("is empty for a theme the contract does not declare", async () => {
        const { getThemeChain } = await chainWith({ "V/root": { src: "/root" } });

        expect(getThemeChain("V/ghost")).toEqual([]);
    });

    test("stops at a parent the contract does not declare", async () => {
        const { getThemeChain } = await chainWith({
            "V/leaf": { src: "/leaf", parent: "V/missing" },
        });

        expect(getThemeChain("V/leaf")).toEqual(["V/leaf"]);
    });

    test("stops on a theme that is its own parent", async () => {
        const { getThemeChain } = await chainWith({
            "V/loop": { src: "/loop", parent: "V/loop" },
        });

        expect(getThemeChain("V/loop")).toEqual(["V/loop"]);
    });

    test("stops on a longer cycle without repeating a theme", async () => {
        const { getThemeChain } = await chainWith({
            "V/a": { src: "/a", parent: "V/b" },
            "V/b": { src: "/b", parent: "V/c" },
            "V/c": { src: "/c", parent: "V/a" },
        });

        expect(getThemeChain("V/b")).toEqual(["V/b", "V/c", "V/a"]);
    });
});

describe("findThemeCycles", () => {
    test("says nothing about a well-formed tree", async () => {
        const { findThemeCycles } = await chainWith({
            "V/leaf": { src: "/leaf", parent: "V/root" },
            "V/root": { src: "/root" },
        });

        expect(findThemeCycles({ "V/leaf": { parent: "V/root" }, "V/root": {} })).toEqual([]);
    });

    test("names the theme a cycle runs through", async () => {
        const { findThemeCycles } = await chainWith({});

        expect(
            findThemeCycles({
                "V/a": { parent: "V/b" },
                "V/b": { parent: "V/a" },
                "V/ok": {},
            }),
        ).toEqual(expect.arrayContaining([expect.stringContaining("V/a")]));
    });
});
