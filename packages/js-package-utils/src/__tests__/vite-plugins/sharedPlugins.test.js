import { jest } from "@jest/globals";

// Mock only the direct leaf dependencies so the heavy precompile graph never
// loads; the real inherit resolvers are kept so we assert their actual names
// and resolveId order.
function mockLeafDeps(configOverrides = {}) {
    const cached = jest.fn(() => ({}));
    jest.unstable_mockModule("../../core/moduleResolver.js", () => ({
        default: { getAllJsVueFilesWithInheritanceCached: cached },
        getAllJsVueFilesWithInheritanceCached: cached,
    }));
    const configDefault = {
        getMagentoConfig: jest.fn(() => ({ ALLOWED_EXTENSIONS: [".js", ".vue"] })),
        getModulesConfigArray: jest.fn(() => []),
        getThemesConfigArray: jest.fn(() => []),
        ...configOverrides,
    };
    jest.unstable_mockModule("../../core/configResolver.js", () => ({
        default: configDefault,
    }));
}

describe("sharedPlugins", () => {
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
    });

    test("getResolverPlugins returns the framework resolution chain in order", async () => {
        mockLeafDeps();
        jest.unstable_mockModule("../../core/preCompileMagentoFiles.js", () => ({
            default: jest.fn(() => Promise.resolve()),
        }));

        const { getResolverPlugins } = await import("../../vite/sharedPlugins.js");
        const plugins = getResolverPlugins();

        expect(plugins.map((p) => p.name)).toEqual([
            "inherit-resolver",
            "inherit-assets-resolver",
            "default-node-resolver",
        ]);
        // The `::` resolvers must run before the node-package fallback.
        expect(plugins[0].resolveId.order).toBe("pre");
        expect(plugins[1].resolveId.order).toBe("pre");
        expect(plugins[2].resolveId.order).toBe("post");
    });

    test("ensurePrecompiled delegates to preCompileMagentoFiles", async () => {
        mockLeafDeps();
        const mockPre = jest.fn(() => Promise.resolve());
        jest.unstable_mockModule("../../core/preCompileMagentoFiles.js", () => ({
            default: mockPre,
        }));

        const { ensurePrecompiled } = await import("../../vite/sharedPlugins.js");
        await ensurePrecompiled("Vendor/theme-test");

        expect(mockPre).toHaveBeenCalledWith("Vendor/theme-test");
    });

    test("getFsAllowList includes the root plus each module/theme src root", async () => {
        mockLeafDeps({
            // A module symlinked from outside the Magento root, plus an
            // in-root theme: both src roots must end up in the allow-list.
            getModulesConfigArray: jest.fn(() => [
                ["Vendor_Module", { src: "/outside/repo/module/src" }],
            ]),
            getThemesConfigArray: jest.fn(() => [
                ["Vendor/theme", { src: "/var/www/html/app/design/frontend/Vendor/theme" }],
            ]),
        });

        const { getFsAllowList } = await import("../../vite/sharedPlugins.js");
        const allow = getFsAllowList("/var/www/html");

        expect(allow).toEqual([
            "/var/www/html",
            "/outside/repo/module/src",
            "/var/www/html/app/design/frontend/Vendor/theme",
        ]);
    });

    test("getFsAllowList dedupes and skips entries without a src", async () => {
        mockLeafDeps({
            getModulesConfigArray: jest.fn(() => [
                ["A", { src: "/var/www/html" }],
                ["B", {}],
            ]),
            getThemesConfigArray: jest.fn(() => []),
        });

        const { getFsAllowList } = await import("../../vite/sharedPlugins.js");
        expect(getFsAllowList("/var/www/html")).toEqual(["/var/www/html"]);
    });
});
