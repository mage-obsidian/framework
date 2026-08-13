import { describe, test, expect } from "vitest";
import {
    extractFontFaces,
    extractCritical,
    mergeDocuments,
    classesInHtml,
    classesInCss,
    classCoverage,
} from "#core/criticalCss.ts";

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

    test("keeps the selectors of every document when given several", async () => {
        const css = ".chrome{color:#000}.subcategory-card{gap:1rem}.product-card{margin:0}.unused{color:green}";
        const doc = (inner) =>
            "<!doctype html><html><head>" +
            '<link rel="stylesheet" href="https://x/style.css">' +
            `</head><body><div class="chrome">${inner}</div></body></html>`;

        const critical = await extractCritical({
            html: [doc('<a class="subcategory-card">Bags</a>'), doc('<article class="product-card">Duffle</article>')],
            css,
        });

        expect(critical).toContain(".subcategory-card");
        expect(critical).toContain(".product-card");
        expect(critical).not.toContain(".unused");
    });

    test("a single document still works when passed as a bare string", async () => {
        const css = ".hero{color:blue}";
        const html = '<html><head><link rel="stylesheet" href="https://x/style.css"></head><body><p class="hero">Hi</p></body></html>';

        expect(await extractCritical({ html, css })).toContain(".hero");
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

describe("mergeDocuments", () => {
    test("returns the document untouched when there is only one", () => {
        const html = "<html><body><p>Hi</p></body></html>";
        expect(mergeDocuments([html])).toBe(html);
    });

    test("splices later bodies into the first, keeping its head", () => {
        const merged = mergeDocuments([
            "<html><head><title>A</title></head><body><p>one</p></body></html>",
            "<html><head><title>B</title></head><body><p>two</p></body></html>",
        ]);

        expect(merged).toContain("<title>A</title>");
        expect(merged).not.toContain("<title>B</title>");
        expect(merged).toContain("one");
        expect(merged).toContain("two");
        expect(merged.indexOf("one")).toBeLessThan(merged.indexOf("two"));
    });

    test("keeps the attributes of the first body tag", () => {
        const merged = mergeDocuments([
            '<html><body class="page-cms" id="top"><p>one</p></body></html>',
            "<html><body><p>two</p></body></html>",
        ]);

        expect(merged).toContain('<body class="page-cms" id="top">');
    });

    test("does not let a $ in the markup be read as a replacement pattern", () => {
        const merged = mergeDocuments([
            "<html><body><p>one</p></body></html>",
            "<html><body><span>$&amp; $` $' $$ $59.00</span></body></html>",
        ]);

        expect(merged).toContain("$&amp; $` $' $$ $59.00");
    });

    test("ignores empty documents", () => {
        expect(mergeDocuments(["", "   ", "<html><body><p>one</p></body></html>"])).toContain("one");
        expect(mergeDocuments([])).toBe("");
    });

    test("appends when the first document has no body tag", () => {
        const merged = mergeDocuments(["<p>one</p>", "<html><body><p>two</p></body></html>"]);
        expect(merged).toContain("one");
        expect(merged).toContain("two");
    });
});

describe("classesInHtml", () => {
    test("reads both quote styles and splits on whitespace", () => {
        const found = classesInHtml(`<div class="a b"><span class='c  d'></span></div>`);
        expect([...found].sort()).toEqual(["a", "b", "c", "d"]);
    });

    test("is empty when there are no class attributes", () => {
        expect(classesInHtml("<p>Hi</p>").size).toBe(0);
    });
});

describe("classesInCss", () => {
    test("unescapes the selectors Tailwind emits", () => {
        const found = classesInCss(".md\\:grid-cols-3{display:grid}.aspect-\\[4\\/5\\]{aspect-ratio:4/5}");
        expect(found.has("md:grid-cols-3")).toBe(true);
        expect(found.has("aspect-[4/5]")).toBe(true);
    });
});

describe("classCoverage", () => {
    const css = ".product-card{margin:0}.products-grid{display:grid}.chrome{color:#000}";

    test("reports the styled classes the critical subset dropped", () => {
        const html = '<div class="chrome"><ol class="products-grid"><li class="product-card"></li></ol></div>';
        const report = classCoverage(html, css, ".chrome{color:#000}");

        expect(report.total).toBe(3);
        expect(report.covered).toBe(1);
        expect(report.missing).toEqual(["product-card", "products-grid"]);
        expect(report.ratio).toBeCloseTo(1 / 3);
    });

    test("ignores classes the stylesheet never styles", () => {
        const html = '<div class="chrome js-hook-with-no-rule"></div>';
        const report = classCoverage(html, css, ".chrome{color:#000}");

        expect(report.total).toBe(1);
        expect(report.ratio).toBe(1);
        expect(report.missing).toEqual([]);
    });

    test("is fully covered when nothing on the page is styled", () => {
        expect(classCoverage("<p>Hi</p>", css, "").ratio).toBe(1);
    });
});
