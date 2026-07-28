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

    it("passes the element through without touching its contents", async () => {
        const el = island({ component: "/static/Card.js" });
        el.innerHTML = "<p>server-rendered</p>";
        const d = deps();

        await hydrateIsland(el, d);

        expect(d.calls.mounted[0].el).toBe(el);
        expect(el.innerHTML).toBe("<p>server-rendered</p>");
    });

    it("takes the same path whether or not the container has server HTML", async () => {
        const filled = island({ component: "/static/Card.js" });
        filled.innerHTML = "<p>server-rendered</p>";
        const empty = island({ component: "/static/Card.js" });
        const d = deps();

        await hydrateIsland(filled, d);
        await hydrateIsland(empty, d);

        expect(d.calls.created).toHaveLength(2);
        expect(d.calls.created[0]).toEqual(d.calls.created[1]);
        expect(d.calls.mounted.map((m) => m.el)).toEqual([filled, empty]);
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

describe("placeholder markup", () => {
    it("clears a container that is not marked for hydration", async () => {
        const el = island({ component: "/static/Card.js" });
        el.innerHTML = "<span>skeleton</span>";
        const d = deps({ clearContainer: vi.fn((e) => { e.innerHTML = ""; }) });

        await hydrateIsland(el, d);

        expect(d.clearContainer).toHaveBeenCalledWith(el);
        expect(el.innerHTML).toBe("");
    });

    it("leaves a hydration target alone", async () => {
        const el = island({ component: "/static/Card.js", hydrate: "" });
        el.dataset.hydrate = "true";
        el.innerHTML = "<span>server</span>";
        const d = deps({ clearContainer: vi.fn() });

        await hydrateIsland(el, d);

        expect(d.clearContainer).not.toHaveBeenCalled();
        expect(el.innerHTML).toBe("<span>server</span>");
    });
});

describe("hydration inspection", () => {
    it("hands the pre-mount snapshot back after mounting", async () => {
        const el = island({ component: "/static/Card.js", hydrate: "true" });
        el.innerHTML = "<span>server</span>";
        const d = deps({
            snapshot: vi.fn((e) => e.innerHTML),
            onMounted: vi.fn(),
        });
        d.createApp = vi.fn(() => ({
            mount: (e) => {
                e.innerHTML = "<span>client</span>";
            },
        }));

        await hydrateIsland(el, d);

        expect(d.onMounted).toHaveBeenCalledWith(el, "<span>server</span>");
        expect(el.innerHTML).toBe("<span>client</span>");
    });

    it("snapshots before the placeholder is cleared, so the baseline is what the page painted", async () => {
        const order = [];
        const el = island({ component: "/static/Card.js" });
        el.innerHTML = "<span>skeleton</span>";
        const d = deps({
            clearContainer: vi.fn((e) => {
                order.push("clearContainer");
                e.innerHTML = "";
            }),
            snapshot: vi.fn((e) => {
                order.push("snapshot");
                return e.innerHTML;
            }),
            onMounted: vi.fn((_, snapshot) => order.push(`onMounted:${snapshot}`)),
        });
        d.createApp = vi.fn(() => {
            order.push("createApp");
            return { mount: () => order.push("mount") };
        });

        await hydrateIsland(el, d);

        expect(order).toEqual([
            "snapshot",
            "clearContainer",
            "createApp",
            "mount",
            "onMounted:<span>skeleton</span>",
        ]);
    });

    it("stays optional so production wiring omits both", async () => {
        const el = island({ component: "/static/Card.js" });

        await expect(hydrateIsland(el, deps())).resolves.toBeDefined();
    });
});

describe("app factory", () => {
    it("asks for a hydrating app only when the marker carries initial state", async () => {
        const seen = [];
        const d = deps();
        d.createApp = vi.fn((component, props, hydrate) => {
            seen.push(hydrate);
            return { mount: () => {} };
        });

        await hydrateIsland(island({ component: "/static/A.js", hydrate: "true" }), d);
        await hydrateIsland(island({ component: "/static/B.js" }), d);

        expect(seen).toEqual([true, false]);
    });
});
