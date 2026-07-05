import { readFileSync, writeFileSync } from "node:fs";
import { extractCritical } from "../core/criticalCss.ts";

// Internal bin the PHP `mage-obsidian:frontend:critical-css` command shells out
// to: it takes the rendered page HTML and the built stylesheet and writes the
// critical CSS. Kept argv-only (no commander) because it is machine-invoked.
function arg(name: string): string | undefined {
    const i = process.argv.indexOf(name);
    return i > -1 ? process.argv[i + 1] : undefined;
}

const htmlFile = arg("--html");
const cssFile = arg("--css");
const outFile = arg("--out");

if (!htmlFile || !cssFile || !outFile) {
    console.error("usage: criticalCss --html <file> --css <file> --out <file>");
    process.exit(1);
}

const html = readFileSync(htmlFile, "utf8");
const css = readFileSync(cssFile, "utf8");
const critical = await extractCritical({ html, css });
writeFileSync(outFile, critical);
console.log(`critical: ${critical.length} bytes -> ${outFile}`);
