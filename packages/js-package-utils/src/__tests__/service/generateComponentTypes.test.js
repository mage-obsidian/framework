import { vi } from "vitest";

function mockFiles(map) {
    const get = vi.fn(() => Promise.resolve(map));
    vi.doMock("../../core/moduleResolver.ts", () => ({
        default: { getAllJsVueFilesWithInheritance: get },
        getAllJsVueFilesWithInheritance: get,
    }));
}

async function generate(themeName = "Vendor/theme") {
    const { default: generateComponentTypes } =
        await import("../../core/generateComponentTypes.ts");
    return generateComponentTypes(themeName);
}

describe("generateComponentTypes", () => {
    const ORIGINAL_MAP = process.env.MAGE_OBSIDIAN_TYPES_PATH_MAP;

    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        delete process.env.MAGE_OBSIDIAN_TYPES_PATH_MAP;
    });

    afterEach(() => {
        if (ORIGINAL_MAP === undefined) delete process.env.MAGE_OBSIDIAN_TYPES_PATH_MAP;
        else process.env.MAGE_OBSIDIAN_TYPES_PATH_MAP = ORIGINAL_MAP;
    });

    test("declares a component with its full specifier and the shorthand, re-exporting default", async () => {
        mockFiles({ "Acme_Mod/components/Foo": "/abs/Acme_Mod/components/Foo.vue" });
        const dts = await generate();
        expect(dts).toContain(`declare module "Acme_Mod::components/Foo"`);
        expect(dts).toContain(`declare module "Acme_Mod::Foo"`);
        expect(dts).toContain(`export { default } from "/abs/Acme_Mod/components/Foo.vue"`);
    });

    test("re-exports the namespace for .js modules and gives them no shorthand", async () => {
        mockFiles({ "Acme_Mod/js/store/main": "/abs/Acme_Mod/js/store/main.js" });
        const dts = await generate();
        expect(dts).toContain(`declare module "Acme_Mod::js/store/main"`);
        expect(dts).toContain(`export * from "/abs/Acme_Mod/js/store/main.js"`);
        // js files are only addressable by their full `js/...` path.
        expect(dts).not.toContain(`declare module "Acme_Mod::store/main"`);
    });

    test("keeps the subpath in the shorthand for nested components", async () => {
        mockFiles({ "Theme/components/elements/Drop": "/abs/Theme/components/elements/Drop.vue" });
        const dts = await generate();
        expect(dts).toContain(`declare module "Theme::components/elements/Drop"`);
        expect(dts).toContain(`declare module "Theme::elements/Drop"`);
    });

    test("applies the path remap to the re-export targets", async () => {
        process.env.MAGE_OBSIDIAN_TYPES_PATH_MAP = "/var/www/html=>/host/src";
        mockFiles({
            "Theme/components/Foo": "/var/www/html/app/design/Foo.vue",
            "Acme_Mod/components/Bar": "/home/dev/module/Bar.vue",
        });
        const dts = await generate();
        expect(dts).toContain(`from "/host/src/app/design/Foo.vue"`);
        // Paths outside the mapped prefix are left untouched.
        expect(dts).toContain(`from "/home/dev/module/Bar.vue"`);
    });
});
