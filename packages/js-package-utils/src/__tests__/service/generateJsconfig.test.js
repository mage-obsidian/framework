import { vi } from "vitest";
import path from "node:path";

function mockFiles(map) {
    const get = vi.fn(() => Promise.resolve(map));
    vi.doMock("../../core/moduleResolver.ts", () => ({
        default: { getAllJsVueFilesWithInheritance: get },
        getAllJsVueFilesWithInheritance: get,
    }));
}

async function load() {
    return import("../../core/generateJsconfig.ts");
}

async function paths(themeName = "Vendor/theme") {
    const { default: generateJsconfigPaths } = await load();
    return generateJsconfigPaths(themeName);
}

describe("generateJsconfigPaths", () => {
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

    test("maps a component to its full specifier and the shorthand", async () => {
        mockFiles({ "Acme_Mod/components/Foo": "/abs/Acme_Mod/components/Foo.vue" });
        const result = await paths();
        expect(result["Acme_Mod::components/Foo"]).toEqual(["/abs/Acme_Mod/components/Foo.vue"]);
        expect(result["Acme_Mod::Foo"]).toEqual(["/abs/Acme_Mod/components/Foo.vue"]);
    });

    test("keeps the subpath in the shorthand for nested components", async () => {
        mockFiles({ "Theme/components/elements/Drop": "/abs/Theme/components/elements/Drop.vue" });
        const result = await paths();
        expect(result["Theme::components/elements/Drop"]).toBeDefined();
        expect(result["Theme::elements/Drop"]).toBeDefined();
    });

    test("gives js modules only their full js/ path, no shorthand", async () => {
        mockFiles({ "Acme_Mod/js/store/main": "/abs/Acme_Mod/js/store/main.js" });
        const result = await paths();
        expect(result["Acme_Mod::js/store/main"]).toEqual(["/abs/Acme_Mod/js/store/main.js"]);
        expect(result["Acme_Mod::store/main"]).toBeUndefined();
    });

    test("adds a node_modules wildcard pointing at the harness install", async () => {
        mockFiles({});
        const result = await paths();
        expect(result["*"]).toEqual([path.join(process.cwd(), "node_modules", "*")]);
    });

    test("prefers the most specific remap prefix regardless of declaration order", async () => {
        // The broad mount is declared first, but the nested vite mount must win
        // for paths under it.
        process.env.MAGE_OBSIDIAN_TYPES_PATH_MAP =
            "/var/www/html=>/host/src,/var/www/html/vite=>/host/harness/vite";
        mockFiles({ "Acme_Mod/components/Bar": "/var/www/html/vite/x/Bar.vue" });
        const result = await paths();
        expect(result["Acme_Mod::components/Bar"]).toEqual(["/host/harness/vite/x/Bar.vue"]);
    });

    test("applies the path remap to specifier targets and the node_modules wildcard", async () => {
        process.env.MAGE_OBSIDIAN_TYPES_PATH_MAP = `/var/www/html=>/host/src`;
        mockFiles({
            "Theme/components/Foo": "/var/www/html/app/design/Foo.vue",
            "Acme_Mod/components/Bar": "/home/dev/module/Bar.vue",
        });
        const result = await paths();
        expect(result["Theme::components/Foo"]).toEqual(["/host/src/app/design/Foo.vue"]);
        // Targets outside the mapped prefix are left untouched.
        expect(result["Acme_Mod::components/Bar"]).toEqual(["/home/dev/module/Bar.vue"]);
    });
});

describe("buildThemeJsconfig", () => {
    beforeEach(() => {
        vi.resetModules();
    });

    test("wraps paths with allowJs, no baseUrl, and a generated marker", async () => {
        const { buildThemeJsconfig, GENERATED_MARKER } = await load();
        const content = buildThemeJsconfig({ "Theme::Foo": ["/abs/Foo.vue"] });
        expect(content.startsWith(GENERATED_MARKER)).toBe(true);

        const json = JSON.parse(content.slice(content.indexOf("\n") + 1));
        expect(json.compilerOptions.allowJs).toBe(true);
        expect(json.compilerOptions.baseUrl).toBeUndefined();
        expect(json.compilerOptions.paths["Theme::Foo"]).toEqual(["/abs/Foo.vue"]);
        expect(json.include).toContain("**/*.vue");
    });
});
