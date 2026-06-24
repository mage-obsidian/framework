import { describe, test, expect } from "vitest";
import resolveVueAlias from "#vite/vueAlias.ts";

describe("resolveVueAlias", () => {
    test("full build in production", () => {
        expect(resolveVueAlias({ runtimeOnly: false, production: true })).toBe(
            "vue/dist/vue.esm-browser.prod.js",
        );
    });

    test("runtime-only in production drops the compiler", () => {
        expect(resolveVueAlias({ runtimeOnly: true, production: true })).toBe(
            "vue/dist/vue.runtime.esm-browser.prod.js",
        );
    });

    test("full build in development", () => {
        expect(resolveVueAlias({ runtimeOnly: false, production: false })).toBe(
            "vue/dist/vue.esm-browser.js",
        );
    });

    test("runtime-only in development", () => {
        expect(resolveVueAlias({ runtimeOnly: true, production: false })).toBe(
            "vue/dist/vue.runtime.esm-browser.js",
        );
    });

    test("defaults to the full development build", () => {
        expect(resolveVueAlias()).toBe("vue/dist/vue.esm-browser.js");
    });
});
