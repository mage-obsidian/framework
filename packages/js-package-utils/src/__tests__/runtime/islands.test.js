import { describe, it, expect, vi } from "vitest";
import {
    componentKey,
    hydrateAll,
    hydrateIsland,
    resolveStrategy,
    UnknownIslandComponent,
} from "../../runtime/islands.ts";

function island(dataset = {}) {
    return { dataset: { ...dataset } };
}

const url = (name) => `/static/generated/Vendor_Module/components/${name}.js`;
const key = (name) => `Vendor_Module/components/${name}`;
const KNOWN = url("Card");
const KNOWN_KEY = key("Card");

function deps(overrides = {}) {
    const calls = { created: [], configured: [], mounted: [], imported: [] };
    const base = {
        calls,
        resolveComponent: vi.fn((name) => async () => {
            calls.imported.push(name);
            return { default: `component:${name}` };
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
        const el = island({ component: KNOWN, props: '{"label":"Hi"}' });
        const d = deps();

        await hydrateIsland(el, d);

        expect(d.calls.imported).toEqual([KNOWN_KEY]);
        expect(d.calls.created).toEqual([
            { component: `component:${KNOWN_KEY}`, props: { label: "Hi" } },
        ]);
        expect(d.calls.configured).toHaveLength(1);
        expect(d.calls.mounted[0].el).toBe(el);
    });

    it("defaults to empty props when data-props is absent", async () => {
        const el = island({ component: KNOWN });
        const d = deps();

        await hydrateIsland(el, d);

        expect(d.calls.created[0].props).toEqual({});
    });

    it("is idempotent: a second call does not mount again", async () => {
        const el = island({ component: KNOWN });
        const d = deps();

        await hydrateIsland(el, d);
        await hydrateIsland(el, d);

        expect(d.resolveComponent).toHaveBeenCalledTimes(1);
        expect(d.calls.mounted).toHaveLength(1);
    });

    it("throws when the marker has no component source", async () => {
        await expect(hydrateIsland(island({}), deps())).rejects.toThrow(/data-component/);
    });

    it("passes the element through without touching its contents", async () => {
        const el = island({ component: KNOWN });
        el.innerHTML = "<p>server-rendered</p>";
        const d = deps();

        await hydrateIsland(el, d);

        expect(d.calls.mounted[0].el).toBe(el);
        expect(el.innerHTML).toBe("<p>server-rendered</p>");
    });

    it("takes the same path whether or not the container has server HTML", async () => {
        const filled = island({ component: KNOWN });
        filled.innerHTML = "<p>server-rendered</p>";
        const empty = island({ component: KNOWN });
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
        const el = island({ component: url("Eager"), strategy: "eager" });
        const d = deps({ observe: vi.fn() });

        hydrateAll([el], d);
        await Promise.resolve();
        await Promise.resolve();

        expect(d.observe).not.toHaveBeenCalled();
        expect(d.resolveComponent).toHaveBeenCalledWith(key("Eager"));
    });

    it("defers visible islands until the observer reports them visible", async () => {
        const el = island({ component: url("Lazy") }); // strategy defaults to "visible"
        let trigger;
        const d = deps({
            observe: vi.fn((_element, onVisible) => {
                trigger = onVisible;
            }),
        });

        hydrateAll([el], d);
        expect(d.observe).toHaveBeenCalledTimes(1);
        expect(d.resolveComponent).not.toHaveBeenCalled();

        trigger();
        await Promise.resolve();
        expect(d.resolveComponent).toHaveBeenCalledWith(key("Lazy"));
    });
});

describe("placeholder markup", () => {
    it("clears a container that is not marked for hydration", async () => {
        const el = island({ component: KNOWN });
        el.innerHTML = "<span>skeleton</span>";
        const d = deps({
            clearContainer: vi.fn((e) => {
                e.innerHTML = "";
            }),
        });

        await hydrateIsland(el, d);

        expect(d.clearContainer).toHaveBeenCalledWith(el);
        expect(el.innerHTML).toBe("");
    });

    // The empty string is what the DOM reports for the valueless `data-hydrate`
    // PHP emits, so it is the only value this case is ever called with.
    it("leaves a hydration target alone", async () => {
        const el = island({ component: KNOWN, hydrate: "" });
        el.innerHTML = "<span>server</span>";
        const d = deps({ clearContainer: vi.fn() });

        await hydrateIsland(el, d);

        expect(d.clearContainer).not.toHaveBeenCalled();
        expect(el.innerHTML).toBe("<span>server</span>");
    });

    it("tells the app factory to hydrate when the marker carries the flag", async () => {
        const el = island({ component: KNOWN, hydrate: "" });
        el.innerHTML = "<span>server</span>";
        const d = deps();

        await hydrateIsland(el, d);

        expect(d.createApp).toHaveBeenCalledWith(`component:${KNOWN_KEY}`, {}, true);
    });

    it("tells the app factory to mount fresh when the marker has no flag", async () => {
        const el = island({ component: KNOWN });
        const d = deps();

        await hydrateIsland(el, d);

        expect(d.createApp).toHaveBeenCalledWith(`component:${KNOWN_KEY}`, {}, false);
    });
});

describe("hydration inspection", () => {
    it("hands the pre-mount snapshot back after mounting", async () => {
        const el = island({ component: KNOWN, hydrate: "true" });
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
        const el = island({ component: KNOWN });
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
        const el = island({ component: KNOWN });

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

        await hydrateIsland(island({ component: url("A"), hydrate: "true" }), d);
        await hydrateIsland(island({ component: url("B") }), d);

        expect(seen).toEqual([true, false]);
    });
});

describe("announce", () => {
    function recorder() {
        const seen = [];
        return { seen, announce: (phase, detail) => seen.push({ phase, ...detail }) };
    }

    it("brackets a successful mount with before and after", async () => {
        const { seen, announce } = recorder();
        let clock = 0;
        const el = island({ component: KNOWN, strategy: "eager" });

        await hydrateIsland(el, deps({ announce, now: () => (clock += 12) }));

        expect(seen.map((entry) => entry.phase)).toEqual(["before", "after"]);
        expect(seen[0]).toMatchObject({
            component: KNOWN,
            strategy: "eager",
            element: el,
        });
        expect(seen[1].durationMs).toBe(12);
    });

    it("defaults the strategy the same way discovery does", async () => {
        const { seen, announce } = recorder();

        await hydrateIsland(island({ component: KNOWN }), deps({ announce }));

        expect(seen[0].strategy).toBe("visible");
    });

    it("announces a failure and still lets the error surface", async () => {
        const { seen, announce } = recorder();
        const boom = new Error("chunk 404");
        const d = deps({
            announce,
            resolveComponent: vi.fn(() => async () => {
                throw boom;
            }),
        });

        await expect(hydrateIsland(island({ component: KNOWN }), d)).rejects.toBe(boom);
        expect(seen.map((entry) => entry.phase)).toEqual(["before", "failed"]);
        expect(seen[1].error).toBe(boom);
    });

    it("says nothing for an element already claimed", async () => {
        const { seen, announce } = recorder();
        const el = island({ component: KNOWN });
        const d = deps({ announce });

        await hydrateIsland(el, d);
        await hydrateIsland(el, d);

        expect(seen).toHaveLength(2);
    });
});

describe("componentKey", () => {
    it("reads the build-output name out of a deployed component URL", () => {
        expect(
            componentKey(
                "https://shop.test/static/v1/frontend/A/b/en_US/generated/Vendor_Module/components/Card.js",
            ),
        ).toBe("Vendor_Module/components/Card");
    });

    it("reads it out of the dev-server path too, which uses a different segment", () => {
        expect(
            componentKey("/static/version1/vite_generated/Vendor_Module/components/Card.js"),
        ).toBe("Vendor_Module/components/Card");
    });

    it("drops the query and hash a cache-busted URL carries", () => {
        expect(componentKey("/static/generated/Vendor_Module/components/Card.js?v=3#x")).toBe(
            "Vendor_Module/components/Card",
        );
    });

    it("refuses a source that names no build output at all", () => {
        expect(componentKey("https://evil.example/payload.js")).toBeNull();
        expect(componentKey("data:text/javascript,alert(1)")).toBeNull();
    });

    it("refuses a traversal dressed up as a component name", () => {
        expect(componentKey("/static/generated/../../../etc/passwd.js")).toBeNull();
    });

    it("refuses an empty name", () => {
        expect(componentKey("/static/generated/")).toBeNull();
    });
});

describe("resolveStrategy", () => {
    it("keeps the strategies the storefront offers", () => {
        expect(resolveStrategy("eager")).toBe("eager");
        expect(resolveStrategy("visible")).toBe("visible");
    });

    it("falls back to the most conservative one for anything else", () => {
        expect(resolveStrategy(undefined)).toBe("visible");
        expect(resolveStrategy("")).toBe("visible");
        expect(resolveStrategy("immediate")).toBe("visible");
        expect(resolveStrategy("EAGER")).toBe("visible");
    });

    it("does not let an unknown strategy mount eagerly", async () => {
        const el = island({ component: KNOWN, strategy: "whenever" });
        const d = deps({ observe: vi.fn() });

        hydrateAll([el], d);

        expect(d.observe).toHaveBeenCalledTimes(1);
        expect(d.resolveComponent).not.toHaveBeenCalled();
    });
});

describe("only what the build produced can mount", () => {
    function gate(available) {
        return (name) => (available[name] ? async () => ({ default: available[name] }) : undefined);
    }

    it("mounts a component the build resolved", async () => {
        const el = island({ component: KNOWN });
        const d = deps({ resolveComponent: vi.fn(gate({ [KNOWN_KEY]: "Card" })) });

        await hydrateIsland(el, d);

        expect(d.calls.mounted).toHaveLength(1);
        expect(d.calls.created[0].component).toBe("Card");
    });

    it("mounts a component the build resolved even though no module offers it to authors", async () => {
        const el = island({ component: url("HeaderNav") });
        const d = deps({ resolveComponent: vi.fn(gate({ [key("HeaderNav")]: "HeaderNav" })) });

        await hydrateIsland(el, d);

        expect(d.calls.mounted).toHaveLength(1);
    });

    it("loads nothing for a component the build never produced", async () => {
        const el = island({ component: url("Forged") });
        const d = deps({ resolveComponent: vi.fn(gate({})) });

        await expect(hydrateIsland(el, d)).resolves.toBeUndefined();
        expect(d.calls.created).toEqual([]);
        expect(d.calls.mounted).toEqual([]);
    });

    it("never turns an address in the markup into something it fetches", async () => {
        const asked = [];
        const el = island({ component: "https://evil.example/payload.js" });
        const d = deps({
            resolveComponent: vi.fn((name) => {
                asked.push(name);
                return undefined;
            }),
        });

        await hydrateIsland(el, d);

        expect(asked).toEqual([]);
        expect(d.calls.created).toEqual([]);
    });

    it("leaves the content the author wrote around a rejected marker alone", async () => {
        const el = island({ component: url("Forged") });
        el.innerHTML = "<p>the rest of the page</p>";
        const d = deps({
            resolveComponent: vi.fn(() => undefined),
            clearContainer: vi.fn((e) => {
                e.innerHTML = "";
            }),
        });

        await hydrateIsland(el, d);

        expect(d.clearContainer).not.toHaveBeenCalled();
        expect(el.innerHTML).toBe("<p>the rest of the page</p>");
    });

    it("records the rejection on the island diagnostic channel, naming what was asked for", async () => {
        const seen = [];
        const el = island({ component: url("Forged") });
        const d = deps({
            resolveComponent: vi.fn(() => undefined),
            announce: (phase, detail) => seen.push({ phase, ...detail }),
        });

        await hydrateIsland(el, d);

        expect(seen.map((entry) => entry.phase)).toEqual(["before", "failed"]);
        expect(seen[1].error).toBeInstanceOf(UnknownIslandComponent);
        expect(seen[1].error.requested).toBe(url("Forged"));
        expect(String(seen[1].error.message)).toContain(url("Forged"));
    });

    it("does not stop the other islands on the page from mounting", async () => {
        const rejected = island({ component: url("Forged"), strategy: "eager" });
        const valid = island({ component: KNOWN, strategy: "eager" });
        const d = deps({
            observe: vi.fn(),
            resolveComponent: vi.fn(gate({ [KNOWN_KEY]: "Card" })),
        });

        hydrateAll([rejected, valid], d);
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        expect(d.calls.mounted).toHaveLength(1);
        expect(d.calls.mounted[0].el).toBe(valid);
    });
});
