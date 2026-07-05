import Beasties from "beasties";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// beasties ships a CJS-typed default export; under NodeNext + verbatimModuleSyntax
// TypeScript widens it to the module namespace (not constructable), though it is
// a class at runtime. Re-type it to the slice of the API we use.
type BeastiesCtor = new (options?: {
    path?: string;
    pruneSource?: boolean;
    mergeStylesheets?: boolean;
    inlineFonts?: boolean;
    preloadFonts?: boolean;
    logLevel?: string;
}) => { process(html: string): Promise<string> };

const BeastiesClass = Beasties as unknown as BeastiesCtor;

const FONT_FACE_RE = /@font-face\s*\{[^}]*\}/g;
const STYLE_RE = /<style[^>]*>([\s\S]*?)<\/style>/i;
const SHEET_LINK_RE = /<link\b[^>]*\bhref="[^"]*\.css"[^>]*>/i;

// Pull the @font-face blocks out of a stylesheet verbatim. They must live in the
// inlined critical CSS so the families are declared before the deferred sheet
// loads — Beasties drops them from the critical subset (inlineFonts is off so it
// never base64s a whole variable font into the head).
export function extractFontFaces(css: string): string {
    return (css.match(FONT_FACE_RE) ?? []).join("");
}

export interface ExtractCriticalOptions {
    html: string;
    css: string;
}

// Run Beasties over the real rendered HTML against the full stylesheet and
// return the critical CSS it would inline. The PHP side does the actual inlining
// and sheet-deferring, so we only need the text; @font-face is prepended because
// Beasties leaves it out of the critical subset.
//
// Beasties resolves <link> hrefs from disk, so the sheet is written to a temp
// dir and the page's stylesheet link is repointed at it.
export async function extractCritical({ html, css }: ExtractCriticalOptions): Promise<string> {
    const dir = mkdtempSync(join(tmpdir(), "mo-critical-"));
    try {
        const sheet = "sheet.css";
        writeFileSync(join(dir, sheet), css);
        // Strip any already-inlined critical <style> (a re-run sees the prior
        // output in the page) and repoint the sheet link so Beasties extracts
        // afresh from the full stylesheet only.
        const wired = html
            .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
            .replace(SHEET_LINK_RE, `<link rel="stylesheet" href="${sheet}">`);
        const beasties = new BeastiesClass({
            path: dir,
            pruneSource: false,
            mergeStylesheets: false,
            inlineFonts: false,
            preloadFonts: false,
            logLevel: "silent",
        });
        const processed = await beasties.process(wired);
        const match = processed.match(STYLE_RE);
        const critical = match ? match[1].trim() : "";
        return [extractFontFaces(css), critical].filter(Boolean).join("\n");
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

export default extractCritical;
