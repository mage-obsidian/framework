import { describe, it, expect, beforeEach, vi } from "vitest";

const FILES = {
    "Vendor_Module/components/Card": "/src/Card.vue",
    "Vendor_Module/js/store": "/src/store.ts",
};

let plugin;
let getAllJsVueFilesWithInheritance;

beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    getAllJsVueFilesWithInheritance = vi.fn(async () => FILES);

    vi.doMock("../../core/configResolver.ts", () => ({
        default: { getMagentoConfig: () => ({ VUE_COMPONENTS_PATH: "components" }) },
    }));
    vi.doMock("../../core/moduleResolver.ts", () => ({
        default: { getAllJsVueFilesWithInheritance },
    }));

    const module = await import("../../vite/islandComponentsPlugin.ts");
    plugin = module.default({ themeName: "Vendor/theme-test" });
});

describe("islandComponentsPlugin", () => {
    it("serves the map in place of the engine's empty placeholder", async () => {
        const source = await plugin.load(
            "/node_modules/mage-obsidian/dist/runtime/islandComponents.js",
        );

        expect(source).toContain('"Vendor_Module/components/Card": () => import("/src/Card.vue")');
    });

    it("serves it whether the source tree or the published build is installed", async () => {
        expect(await plugin.load("/pkg/src/runtime/islandComponents.ts")).toContain("Card.vue");
        expect(await plugin.load("/pkg/dist/runtime/islandComponents.js?v=1")).toContain(
            "Card.vue",
        );
    });

    it("leaves every other module to the rest of the chain", async () => {
        expect(await plugin.load("/pkg/dist/runtime/islands.js")).toBeNull();
        expect(await plugin.load("/pkg/dist/core/islandComponents.js")).toBeNull();
        expect(await plugin.load("/src/Card.vue")).toBeNull();
    });

    it("asks for the theme it was given", async () => {
        await plugin.load("/pkg/dist/runtime/islandComponents.js");

        expect(getAllJsVueFilesWithInheritance).toHaveBeenCalledWith("Vendor/theme-test");
    });

    it("re-reads the resolution on every load, so a component added mid dev server appears", async () => {
        await plugin.load("/pkg/dist/runtime/islandComponents.js");
        getAllJsVueFilesWithInheritance.mockResolvedValueOnce({
            ...FILES,
            "Vendor_Module/components/Fresh": "/src/Fresh.vue",
        });

        const source = await plugin.load("/pkg/dist/runtime/islandComponents.js");

        expect(getAllJsVueFilesWithInheritance).toHaveBeenCalledTimes(2);
        expect(source).toContain("Vendor_Module/components/Fresh");
    });

    it("stops naming a component the theme no longer resolves, with no list to edit", async () => {
        getAllJsVueFilesWithInheritance.mockResolvedValueOnce({});

        expect(await plugin.load("/pkg/dist/runtime/islandComponents.js")).not.toContain("Card");
    });
});
