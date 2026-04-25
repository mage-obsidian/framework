import { describe, it, expect, vi } from "vitest";
import { hydrateIsland, hydrateAll } from "../../runtime/islands.ts";

function island(dataset = {}) {
    return { dataset: { ...dataset } };
}

function deps(overrides = {}) {
    const calls = { created: [], configured: [], mounted: [], imported: [] };
    const base = {
        calls,
        importComponent: vi.fn(async (src) => {
            calls.imported.push(src);
            return { default: `component:${src}` };
        }),
        createApp: vi.fn((component, props) => {
            const app = { component, props };
            calls.created.push({ component, props });
            app.mount = (el) => calls.mounted.push({ app, el });
            return app;
        }),
        configureApp: vi.fn((app) => calls.configured.push(app)),
    };
    return { ...base, ...overrides };
}

describe("hydrateIsland", () => {
    it("imports the component, creates+configures the app, and mounts on the element", async () => {
        const el = island({ component: "/static/Card.js", props: '{"label":"Hi"}' });
        const d = deps();

        await hydrateIsland(el, d);

        expect(d.calls.imported).toEqual(["/static/Card.js"]);
        expect(d.calls.created).toEqual([
            { component: "component:/static/Card.js", props: { label: "Hi" } },
        ]);
        expect(d.calls.configured).toHaveLength(1);
        expect(d.calls.mounted[0].el).toBe(el);
    });

    it("defaults to empty props when data-props is absent", async () => {
        const el = island({ component: "/static/Card.js" });
        const d = deps();

        await hydrateIsland(el, d);

        expect(d.calls.created[0].props).toEqual({});
    });

    it("is idempotent: a second call does not mount again", async () => {
        const el = island({ component: "/static/Card.js" });
        const d = deps();

        await hydrateIsland(el, d);
        await hydrateIsland(el, d);

        expect(d.importComponent).toHaveBeenCalledTimes(1);
        expect(d.calls.mounted).toHaveLength(1);
    });

    it("throws when the marker has no component source", async () => {
        await expect(hydrateIsland(island({}), deps())).rejects.toThrow(/data-component/);
    });
});

describe("hydrateAll", () => {
    it("mounts eager islands immediately", async () => {
        const el = island({ component: "/static/Eager.js", strategy: "eager" });
        const d = deps({ observe: vi.fn() });

        hydrateAll([el], d);
        await Promise.resolve();
        await Promise.resolve();

        expect(d.observe).not.toHaveBeenCalled();
        expect(d.importComponent).toHaveBeenCalledWith("/static/Eager.js");
    });

    it("defers visible islands until the observer reports them visible", async () => {
        const el = island({ component: "/static/Lazy.js" }); // strategy defaults to "visible"
        let trigger;
        const d = deps({
            observe: vi.fn((_element, onVisible) => {
                trigger = onVisible;
            }),
        });

        hydrateAll([el], d);
        expect(d.observe).toHaveBeenCalledTimes(1);
        expect(d.importComponent).not.toHaveBeenCalled();

        trigger();
        await Promise.resolve();
        expect(d.importComponent).toHaveBeenCalledWith("/static/Lazy.js");
    });
});
