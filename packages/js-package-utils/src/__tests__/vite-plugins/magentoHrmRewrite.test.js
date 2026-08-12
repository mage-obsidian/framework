import { vi } from "vitest";

function fakeServer() {
    const handlers = [];
    return {
        middlewares: { use: (fn) => handlers.push(fn) },
        run(url) {
            const req = { url };
            const res = {
                headers: {},
                setHeader(k, v) {
                    this.headers[k] = v;
                },
            };
            let nextCalls = 0;
            handlers[0](req, res, () => nextCalls++);
            return { req, res, nextCalls };
        },
    };
}

describe("handle-magento-routes-middleware", () => {
    beforeEach(() => {
        vi.resetModules();
    });

    async function withComponents(getComponents) {
        vi.doMock("#core/moduleResolver.ts", () => ({
            __esModule: true,
            default: { getAllJsVueFilesWithInheritanceCached: vi.fn(getComponents) },
        }));
        const { default: factory } = await import("#vite/magentoHrmRewrite.ts");
        const plugin = factory();
        const server = fakeServer();
        plugin.configureServer(server);
        return server;
    }

    test("rewrites a known component to its file on disk", async () => {
        const server = await withComponents(() => ({
            "Vendor_Module/js/known": "/abs/js/known.js",
        }));

        const { req } = server.run("/Vendor_Module/js/known.js");

        expect(req.url).toBe("/@fs/abs/js/known.js");
    });

    test("passes an unknown url through untouched", async () => {
        const server = await withComponents(() => ({}));

        const { req, nextCalls } = server.run("/nothing/here.js");

        expect(req.url).toBe("/nothing/here.js");
        expect(nextCalls).toBe(1);
    });

    // Same freeze as inherit-resolver: the middleware is registered once when the
    // dev server boots, so reading the map outside the request handler pins it to
    // whatever existed at boot and a component added later 404s until restart.
    test("serves a component registered after the server was configured", async () => {
        let components = { "Vendor_Module/js/known": "/abs/js/known.js" };
        const server = await withComponents(() => components);

        components = { ...components, "Vendor_Module/js/fresh": "/abs/js/fresh.js" };
        const { req } = server.run("/Vendor_Module/js/fresh.js");

        expect(req.url).toBe("/@fs/abs/js/fresh.js");
    });

    test("labels a lib stylesheet with its mime type", async () => {
        const server = await withComponents(() => ({ "lib/x": "/abs/lib/x.css" }));

        const { res } = server.run("/lib/x.css");

        expect(res.headers["Content-Type"]).toBe("text/css");
    });
});
