import { readFileSync, writeFileSync } from "node:fs";
import { extractCritical, mergeDocuments, classCoverage } from "../core/criticalCss.ts";

// Internal bin the PHP `mage-obsidian:frontend:critical-css` command shells out
// to: it takes the rendered page HTML and the built stylesheet and writes the
// critical CSS. Kept argv-only (no commander) because it is machine-invoked.
function arg(name: string): string | undefined {
    const i = process.argv.indexOf(name);
    return i > -1 ? process.argv[i + 1] : undefined;
}

function args(name: string): string[] {
    const found: string[] = [];
    process.argv.forEach((value, i) => {
        if (value === name && process.argv[i + 1] !== undefined) {
            found.push(process.argv[i + 1]);
        }
    });
    return found;
}

const htmlFiles = args("--html");
const cssFile = arg("--css");
const outFile = arg("--out");
const minCoverage = Number(arg("--min-coverage") ?? "0");

if (htmlFiles.length === 0 || !cssFile || !outFile) {
    console.error("usage: criticalCss --html <file> [--html <file>…] --css <file> --out <file> [--min-coverage <0..1>]");
    process.exit(1);
}

const htmls = htmlFiles.map((file) => readFileSync(file, "utf8"));
const css = readFileSync(cssFile, "utf8");
const critical = await extractCritical({ html: htmls, css });
writeFileSync(outFile, critical);

const coverage = classCoverage(mergeDocuments(htmls), css, critical);
console.log(
    `critical: ${critical.length} bytes -> ${outFile} ` +
        `(coverage ${(coverage.ratio * 100).toFixed(1)}%, ${coverage.covered}/${coverage.total} classes)`
);

if (coverage.ratio < minCoverage) {
    console.error(
        `critical CSS covers ${(coverage.ratio * 100).toFixed(1)}% of the styled classes, ` +
            `below the required ${(minCoverage * 100).toFixed(1)}%. Missing: ` +
            coverage.missing.slice(0, 20).join(", ") +
            (coverage.missing.length > 20 ? `, and ${coverage.missing.length - 20} more` : "")
    );
    process.exit(2);
}
