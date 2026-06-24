import { describe, test, expect } from "vitest";
import { extractFontFaces, extractCritical } from "#core/criticalCss.ts";

describe("extractFontFaces", () => {
    test("returns only the @font-face blocks", () => {
        const css =
            '@font-face{font-family:"A";src:url(a.woff2)}.x{color:red}@font-face{font-family:"B"}';
        const faces = extractFontFaces(css);
        expect(faces).toContain('"A"');
        expect(faces).toContain('"B"');
        expect(faces).not.toContain("color:red");
    });

    test("empty string when there are none", () => {
        expect(extractFontFaces(".x{color:red}")).toBe("");
    });
});

describe("extractCritical", () => {
    test("keeps used selectors and @font-face, drops unused", async () => {
        const css =
            '@font-face{font-family:"Hero";src:url(h.woff2)}' +
            ".hero{color:blue}.used{margin:0}.unused{color:green}";
        const html =
            "<!doctype html><html><head>" +
            '<link rel="stylesheet" href="https://x/generated/css/style.css">' +
            '</head><body><div class="hero used">Hi</div></body></html>';

        const critical = await extractCritical({ html, css });

        expect(critical).toContain("@font-face");
        expect(critical).toContain(".hero");
        expect(critical).toContain(".used");
        expect(critical).not.toContain(".unused");
    });

    test("starts with @font-face so families resolve before the deferred sheet", async () => {
        const css = '@font-face{font-family:"Hero"}.hero{color:blue}';
        const html =
            '<html><head><link rel="stylesheet" href="https://x/style.css"></head>' +
            '<body><div class="hero">Hi</div></body></html>';

        const critical = await extractCritical({ html, css });

        expect(critical.trimStart().startsWith("@font-face")).toBe(true);
    });

    test("drops a previously inlined critical <style> on re-run", async () => {
        const css = ".hero{color:blue}";
        const html =
            "<!doctype html><html><head>" +
            '<style data-type="criticalCss">.stale{color:red}</style>' +
            '<link rel="stylesheet" href="https://x/style.css">' +
            '</head><body><div class="hero">Hi</div></body></html>';

        const critical = await extractCritical({ html, css });

        expect(critical).toContain(".hero");
        expect(critical).not.toContain(".stale");
    });
});
