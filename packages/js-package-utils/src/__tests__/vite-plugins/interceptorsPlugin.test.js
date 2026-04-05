import { vi } from "vitest";
// import interceptorsPlugin from '../../vite/interceptorsPlugin.ts'; // Removed static import

describe("interceptorsPlugin", () => {
    let plugin;
    let mockGenerateInterceptors;
    let mockResolve;
    const themeName = "Vendor/theme-test";

    beforeEach(async () => {
        vi.resetModules(); // Reset modules to ensure fresh imports and mocks
        vi.clearAllMocks();

        // Mock configResolver to prevent process.exit
        vi.doMock("../../core/configResolver.ts", () => ({
            default: {
                resolveLibRealPath: vi.fn(),
            },
        }));

        // Mock generateInterceptorsService
        mockGenerateInterceptors = vi.fn();

        // Mock the service module
        vi.doMock("../../core/generateInterceptors.ts", () => ({
            default: {
                generateInterceptors: mockGenerateInterceptors,
            },
        }));

        // Re-import the plugin to use the mock
        const pluginModule = await import("../../vite/interceptorsPlugin.ts");
        const createPlugin = pluginModule.default;

        plugin = createPlugin({ themeName });

        // Mock Vite context
        mockResolve = vi.fn();
        plugin.resolve = mockResolve; // Bind mock to the plugin instance context if needed, but resolveId is called on context
    });

    test("should generate interceptors on buildStart", async () => {
        mockGenerateInterceptors.mockResolvedValue({});
        await plugin.buildStart.call({});
        expect(mockGenerateInterceptors).toHaveBeenCalledWith(themeName);
    });

    test("should resolve to virtual ID if interceptor exists", async () => {
        const targetPath = "/abs/path/to/target.js";
        const interceptors = {
            "Target::Method": {
                targetPath: targetPath,
                source: "export const intercepted = true;",
            },
        };
        mockGenerateInterceptors.mockResolvedValue(interceptors);

        // Initialize plugin
        await plugin.buildStart.call({});

        // Mock resolve to return the absolute path
        const context = {
            resolve: vi.fn().mockResolvedValue({ id: targetPath }),
        };

        const result = await plugin.resolveId.call(context, "./target.js", "/importer.js");

        expect(context.resolve).toHaveBeenCalledWith("./target.js", "/importer.js", {
            skipSelf: true,
        });
        expect(result).toBe(`\0interceptor:${targetPath}`);
    });

    test("should NOT resolve to virtual ID if importer IS the virtual ID (loop prevention)", async () => {
        const targetPath = "/abs/path/to/target.js";
        const interceptors = {
            "Target::Method": {
                targetPath: targetPath,
                source: "export const intercepted = true;",
            },
        };
        mockGenerateInterceptors.mockResolvedValue(interceptors);

        await plugin.buildStart.call({});

        const context = {
            resolve: vi.fn().mockResolvedValue({ id: targetPath }),
        };

        const virtualId = `\0interceptor:${targetPath}`;
        const result = await plugin.resolveId.call(context, "./target.js", virtualId);

        expect(result).toBeNull();
    });

    test("should load generated source for virtual ID", async () => {
        const targetPath = "/abs/path/to/target.js";
        const sourceCode = "export const intercepted = true;";
        const interceptors = {
            "Target::Method": {
                targetPath: targetPath,
                source: sourceCode,
            },
        };
        mockGenerateInterceptors.mockResolvedValue(interceptors);

        await plugin.buildStart.call({});

        const virtualId = `\0interceptor:${targetPath}`;
        const result = plugin.load.call({}, virtualId);

        expect(result).toBe(sourceCode);
    });

    test("should return null for unknown virtual ID", async () => {
        mockGenerateInterceptors.mockResolvedValue({});
        await plugin.buildStart.call({});

        const result = plugin.load.call({}, "\0interceptor:/unknown.js");
        expect(result).toBeNull();
    });
});
