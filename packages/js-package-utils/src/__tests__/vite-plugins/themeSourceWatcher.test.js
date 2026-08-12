import { vi } from "vitest";

const THEME = "Vendor/theme-a";

function fakeServer() {
    const listeners = { add: [], unlink: [] };
    return {
        added: [],
        listeners,
        watcher: {
            add(dir) {
                this.added.push(dir);
            },
            on(event, fn) {
                listeners[event].push(fn);
            },
        },
        config: { logger: { info: vi.fn(), error: vi.fn() } },
        emit(event, file) {
            for (const fn of listeners[event]) fn(file);
        },
    };
}

describe("theme-source-watcher", () => {
    let mocks;

    beforeEach(async () => {
        vi.resetModules();
        vi.useFakeTimers();

        mocks = {
            invalidateTheme: vi.fn(),
            invalidateInterceptors: vi.fn(),
            precompileJs: vi.fn().mockResolvedValue(undefined),
            precompileJsconfig: vi.fn().mockResolvedValue(undefined),
            precompileTsconfig: vi.fn().mockResolvedValue(undefined),
        };

        vi.doMock("#core/configResolver.ts", () => ({
            default: {
                getModulesConfigArray: () => [["Vendor_Module", { src: "/modules/vendor" }]],
                getMagentoConfig: () => ({
                    themes: {
                        [THEME]: { src: "/themes/a", parent: "Vendor/theme-base" },
                        "Vendor/theme-base": { src: "/themes/base" },
                    },
                }),
            },
        }));
        vi.doMock("#core/moduleResolver.ts", () => ({
            default: { invalidateTheme: mocks.invalidateTheme },
        }));
        vi.doMock("#core/generateInterceptors.ts", () => ({
            default: { invalidateTheme: mocks.invalidateInterceptors },
        }));
        vi.doMock("#core/preCompileFiles.ts", () => ({
            precompileJs: mocks.precompileJs,
            precompileJsconfig: mocks.precompileJsconfig,
            precompileTsconfig: mocks.precompileTsconfig,
        }));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    async function boot() {
        const { default: factory } = await import("#vite/themeSourceWatcher.ts");
        const plugin = factory(THEME);
        const server = fakeServer();
        server.watcher.added = server.added;
        plugin.configureServer(server);
        return { plugin, server };
    }

    test("only runs on the dev server", async () => {
        const { plugin } = await boot();

        expect(plugin.apply).toBe("serve");
    });

    test("watches every module web dir and the whole theme chain", async () => {
        const { server } = await boot();

        expect(server.added).toEqual(expect.arrayContaining(["/themes/a", "/themes/base"]));
    });

    test("ignores files that cannot change what an import resolves to", async () => {
        const { server } = await boot();

        server.emit("add", "/themes/a/Vendor_Module/web/css/theme.source.css");
        server.emit("add", "/themes/a/web/generated/js/built.js");
        server.emit("add", "/themes/a/.precompiled/Vendor_theme-a/x.js");
        await vi.runAllTimersAsync();

        expect(mocks.precompileJs).not.toHaveBeenCalled();
    });

    // The interceptor caches used to survive this: adding a component refreshed
    // the inheritance map but an interceptor pointing at it stayed compiled from
    // the boot-time config, so the plugin silently never applied until restart.
    test("drops the interceptor caches alongside the module ones", async () => {
        const { server } = await boot();

        server.emit("add", "/modules/vendor/web/js/new-component.ts");
        await vi.runAllTimersAsync();

        expect(mocks.invalidateTheme).toHaveBeenCalledWith(THEME);
        expect(mocks.invalidateInterceptors).toHaveBeenCalledWith(THEME);
        expect(mocks.precompileJs).toHaveBeenCalledWith(THEME);
    });

    test("collapses a burst of events into one regeneration", async () => {
        const { server } = await boot();

        for (let i = 0; i < 5; i++) {
            server.emit("add", `/modules/vendor/web/js/burst-${i}.ts`);
        }
        await vi.runAllTimersAsync();

        expect(mocks.precompileJs).toHaveBeenCalledTimes(1);
    });
});
