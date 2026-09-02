import { describe, it, expect } from "vitest";
import {
    isComponentMapModule,
    mountableComponents,
    renderComponentMap,
} from "../../core/islandComponentMap.ts";

const FILES = {
    "Vendor_Module/components/Card": "/src/Vendor_Module/components/Card.vue",
    "Vendor_Module/components/nav/Menu": "/src/Vendor_Module/components/nav/Menu.vue",
    "Vendor_Module/js/store": "/src/Vendor_Module/js/store.ts",
    "Theme/components/Hero": "/theme/web/components/Hero.vue",
    "Theme/js/boot": "/theme/web/js/boot.ts",
};

describe("mountableComponents", () => {
    it("carries every component the theme resolved", () => {
        expect(Object.keys(mountableComponents(FILES))).toEqual([
            "Theme/components/Hero",
            "Vendor_Module/components/Card",
            "Vendor_Module/components/nav/Menu",
        ]);
    });

    it("leaves out the plain scripts, which no marker can ever name", () => {
        const map = mountableComponents(FILES);

        expect(map).not.toHaveProperty("Vendor_Module/js/store");
        expect(map).not.toHaveProperty("Theme/js/boot");
    });

    it("points each name at the file the inheritance chain resolved", () => {
        expect(mountableComponents(FILES)["Vendor_Module/components/Card"]).toBe(
            "/src/Vendor_Module/components/Card.vue",
        );
    });

    it("takes the components directory from the contract rather than assuming it", () => {
        const files = { "Vendor_Module/widgets/Card": "/src/Card.vue" };

        expect(mountableComponents(files, "widgets")).toEqual(files);
        expect(mountableComponents(files)).toEqual({});
    });

    it("drops a component a theme override resolved to nothing", () => {
        expect(mountableComponents({ "Vendor_Module/components/Gone": "" })).toEqual({});
    });

    it("holds nothing when the theme resolved nothing", () => {
        expect(mountableComponents({})).toEqual({});
    });
});

describe("renderComponentMap", () => {
    it("emits a default export the bundler can follow to every component", () => {
        const source = renderComponentMap(mountableComponents(FILES));

        expect(source).toContain(
            '"Vendor_Module/components/Card": () => import("/src/Vendor_Module/components/Card.vue")',
        );
        expect(source).toContain(
            '"Theme/components/Hero": () => import("/theme/web/components/Hero.vue")',
        );
        expect(source.trimEnd().endsWith("export default components;")).toBe(true);
    });

    it("names no script that is not a component", () => {
        expect(renderComponentMap(mountableComponents(FILES))).not.toContain("js/store");
    });

    it("stays valid when the theme resolved no component at all", () => {
        expect(renderComponentMap({})).toContain("const components = {");
    });

    it("escapes a path so it cannot break out of the import", () => {
        const source = renderComponentMap({ 'Odd"Name': '/src/a"b.vue' });

        expect(source).toContain('"Odd\\"Name"');
        expect(source).toContain('import("/src/a\\"b.vue")');
    });
});

describe("isComponentMapModule", () => {
    it("recognises the placeholder in both the source tree and the published build", () => {
        expect(isComponentMapModule("/pkg/src/runtime/islandComponents.ts")).toBe(true);
        expect(isComponentMapModule("/pkg/dist/runtime/islandComponents.js")).toBe(true);
        expect(isComponentMapModule("/pkg/dist/runtime/islandComponents.js?v=1")).toBe(true);
    });

    it("does not claim a module that merely looks like it", () => {
        expect(isComponentMapModule("/pkg/dist/runtime/islands.js")).toBe(false);
        expect(isComponentMapModule("/pkg/dist/core/islandComponents.js")).toBe(false);
        expect(isComponentMapModule("/pkg/dist/runtime/islandComponentsExtra.ts")).toBe(false);
    });
});
