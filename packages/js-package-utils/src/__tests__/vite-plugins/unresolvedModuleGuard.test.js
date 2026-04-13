import { vi } from "vitest";

function mockCache(keys) {
    const map = Object.fromEntries(keys.map((k) => [k, `/abs/${k}`]));
    const cached = vi.fn(() => map);
    vi.doMock("../../core/moduleResolver.ts", () => ({
        default: { getAllJsVueFilesWithInheritanceCached: cached },
        getAllJsVueFilesWithInheritanceCached: cached,
    }));
}

async function loadGuard() {
    const { default: factory } = await import("../../vite/unresolvedModuleGuard.ts");
    return factory();
}

function resolve(plugin, id, importer) {
    return plugin.resolveId.handler(id, importer);
}

describe("unresolvedModuleGuard", () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
    });

    test("runs post and only inspects ids (never resolves)", async () => {
        mockCache([]);
        const plugin = await loadGuard();
        expect(plugin.name).toBe("unresolved-module-guard");
        expect(plugin.resolveId.order).toBe("post");
    });

    test("throws on an unresolved :: specifier, naming specifier and importer", async () => {
        mockCache(["MageObsidian_ModernFrontend/components/TechnologiesSlider"]);
        const plugin = await loadGuard();
        expect(() =>
            resolve(
                plugin,
                "MageObsidian_ModernFrontend::components/Technologieslider",
                "/x/foo.vue",
            ),
        ).toThrow(/Unresolved import "MageObsidian_ModernFrontend::components\/Technologieslider"/);
        expect(() =>
            resolve(
                plugin,
                "MageObsidian_ModernFrontend::components/Technologieslider",
                "/x/foo.vue",
            ),
        ).toThrow(/imported by: \/x\/foo\.vue/);
    });

    test("suggests the closest registered component", async () => {
        mockCache([
            "MageObsidian_ModernFrontend/components/TechnologiesSlider",
            "Theme/components/Discord",
        ]);
        const plugin = await loadGuard();
        try {
            resolve(plugin, "MageObsidian_ModernFrontend::components/TechnologiesSlder");
            throw new Error("expected throw");
        } catch (e) {
            expect(e.message).toContain("Did you mean");
            expect(e.message).toContain(
                "MageObsidian_ModernFrontend::components/TechnologiesSlider",
            );
        }
    });

    test("hints asset lookup locations for an unresolved asset", async () => {
        mockCache([]);
        const plugin = await loadGuard();
        try {
            resolve(plugin, "MageObsidian_ModernFrontend::assets/typo.png");
            throw new Error("expected throw");
        } catch (e) {
            expect(e.message).toContain("Asset not found");
            expect(e.message).toContain("view/frontend/web/assets/typo.png");
        }
    });

    test("ignores ids without ::", async () => {
        mockCache([]);
        const plugin = await loadGuard();
        expect(resolve(plugin, "vue")).toBeUndefined();
        expect(resolve(plugin, "./local/file.js")).toBeUndefined();
    });

    test("ignores virtual ids and non-namespace prefixes", async () => {
        mockCache([]);
        const plugin = await loadGuard();
        expect(resolve(plugin, "\0virtual::thing")).toBeUndefined();
        expect(resolve(plugin, "lowercase::thing")).toBeUndefined();
        expect(resolve(plugin, "/abs/path::weird")).toBeUndefined();
    });
});
