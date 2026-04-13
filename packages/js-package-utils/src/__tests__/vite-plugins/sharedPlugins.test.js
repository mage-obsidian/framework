import { vi } from "vitest";

// Mock only the direct leaf dependencies so the heavy precompile graph never
// loads; the real inherit resolvers are kept so we assert their actual names
// and resolveId order.
function mockLeafDeps(configOverrides = {}) {
    const cached = vi.fn(() => ({}));
    vi.doMock("../../core/moduleResolver.ts", () => ({
        default: { getAllJsVueFilesWithInheritanceCached: cached },
        getAllJsVueFilesWithInheritanceCached: cached,
    }));
    const configDefault = {
        getMagentoConfig: vi.fn(() => ({ ALLOWED_EXTENSIONS: [".js", ".vue"] })),
        getModulesConfigArray: vi.fn(() => []),
        getThemesConfigArray: vi.fn(() => []),
        ...configOverrides,
    };
    vi.doMock("../../core/configResolver.ts", () => ({
        default: configDefault,
    }));
}

describe("sharedPlugins", () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
    });

    test("getResolverPlugins returns the framework resolution chain in order", async () => {
        mockLeafDeps();
        vi.doMock("../../core/preCompileMagentoFiles.ts", () => ({
            default: vi.fn(() => Promise.resolve()),
        }));

        const { getResolverPlugins } = await import("../../vite/sharedPlugins.ts");
        const plugins = getResolverPlugins();

        expect(plugins.map((p) => p.name)).toEqual([
            "inherit-resolver",
            "inherit-assets-resolver",
            "default-node-resolver",
            "unresolved-module-guard",
        ]);
        // The `::` resolvers must run before the node-package fallback.
        expect(plugins[0].resolveId.order).toBe("pre");
        expect(plugins[1].resolveId.order).toBe("pre");
        expect(plugins[2].resolveId.order).toBe("post");
        // The fail-loud guard runs last so it only sees genuinely unresolved ids.
        expect(plugins[3].resolveId.order).toBe("post");
    });

    test("ensurePrecompiled delegates to preCompileMagentoFiles", async () => {
        mockLeafDeps();
        const mockPre = vi.fn(() => Promise.resolve());
        vi.doMock("../../core/preCompileMagentoFiles.ts", () => ({
            default: mockPre,
        }));

        const { ensurePrecompiled } = await import("../../vite/sharedPlugins.ts");
        await ensurePrecompiled("Vendor/theme-test");

        expect(mockPre).toHaveBeenCalledWith("Vendor/theme-test");
    });

    test("getFsAllowList includes the root plus each module/theme src root", async () => {
        mockLeafDeps({
            // A module symlinked from outside the Magento root, plus an
            // in-root theme: both src roots must end up in the allow-list.
            getModulesConfigArray: vi.fn(() => [
                ["Vendor_Module", { src: "/outside/repo/module/src" }],
            ]),
            getThemesConfigArray: vi.fn(() => [
                ["Vendor/theme", { src: "/var/www/html/app/design/frontend/Vendor/theme" }],
            ]),
        });

        const { getFsAllowList } = await import("../../vite/sharedPlugins.ts");
        const allow = getFsAllowList("/var/www/html");

        expect(allow).toEqual([
            "/var/www/html",
            "/outside/repo/module/src",
            "/var/www/html/app/design/frontend/Vendor/theme",
        ]);
    });

    test("getFsAllowList dedupes and skips entries without a src", async () => {
        mockLeafDeps({
            getModulesConfigArray: vi.fn(() => [
                ["A", { src: "/var/www/html" }],
                ["B", {}],
            ]),
            getThemesConfigArray: vi.fn(() => []),
        });

        const { getFsAllowList } = await import("../../vite/sharedPlugins.ts");
        expect(getFsAllowList("/var/www/html")).toEqual(["/var/www/html"]);
    });
});
