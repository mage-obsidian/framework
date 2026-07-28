import { describe, it, expect, vi } from "vitest";
import { extractTemplate, formatForReading, renderIsland } from "../../core/islandSsr.ts";

describe("extractTemplate", () => {
    it("returns the contents of the template block", () => {
        const sfc = "<script setup>const a = 1;</script>\n<template>\n  <p>hi</p>\n</template>\n";

        expect(extractTemplate(sfc)).toBe("<p>hi</p>");
    });

    it("keeps a nested template element intact", () => {
        const sfc = '<template><div><template v-if="x"><b>y</b></template></div></template>';

        expect(extractTemplate(sfc)).toBe('<div><template v-if="x"><b>y</b></template></div>');
    });

    it("handles a template block carrying attributes", () => {
        expect(extractTemplate('<template lang="html"><p>hi</p></template>')).toBe("<p>hi</p>");
    });

    it("names the file when there is no template to render", () => {
        expect(() => extractTemplate("<script setup></script>", "Toast.vue")).toThrow(
            /Toast\.vue has no <template>/,
        );
    });
});

describe("renderIsland", () => {
    it("declares the props and exposes the state as setup bindings", async () => {
        const deps = {
            createSSRApp: vi.fn((component, props) => ({ component, props })),
            renderToString: vi.fn(async (app) => `rendered:${app.component.template}`),
        };
        const state = { price: "$49.00", isAvailable: () => true };

        const html = await renderIsland("<p>{{ price }}</p>", state, { sku: "WSH11" }, deps);

        const [component, props] = deps.createSSRApp.mock.calls[0];
        expect(component.props).toEqual(["sku"]);
        expect(component.setup()).toEqual(state);
        expect(props).toEqual({ sku: "WSH11" });
        expect(html).toBe("rendered:<p>{{ price }}</p>");
    });
});

describe("formatForReading", () => {
    it("puts each element on its own line", () => {
        expect(formatForReading("<p>a</p><b>c</b>")).toBe("<p>a</p>\n<b>c</b>");
    });
});

describe("renderIsland child components", () => {
    it("registers a components map instead of leaving it in the bindings", async () => {
        const deps = {
            createSSRApp: vi.fn((component) => ({ component })),
            renderToString: vi.fn(async () => "ok"),
        };
        const Icon = { render: () => null };

        await renderIsland("<Icon/>", { components: { Icon }, price: "$1" }, {}, deps);

        const [component] = deps.createSSRApp.mock.calls[0];
        expect(component.components).toEqual({ Icon });
        expect(component.setup()).toEqual({ price: "$1" });
    });
});
