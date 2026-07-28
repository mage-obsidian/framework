import fs from "node:fs/promises";
import path from "node:path";
import { CMS_BASELINE_FILE, CMS_CANDIDATES_FILE, CMS_CONTENT_DIR, OUTPUT_THEME_DIR } from "../config/default.ts";
import configResolver from "./configResolver.ts";

const { getThemeDefinition } = configResolver;

/**
 * Pin the class list this build covered next to the build's own output.
 *
 * The storefront compiles, at runtime, the difference between the classes in
 * CMS content now and the ones the stylesheet already carries. That subtraction
 * needs a baseline, and the baseline has to be the one this build actually
 * scanned — leaving it in `var/` would let an export run afterwards and quietly
 * move it. Writing it into the theme's generated dir ties the two together and
 * makes it travel with whatever gets deployed.
 *
 * A missing export means the build scanned no CMS content at all, which is an
 * empty baseline — not an error.
 */
export async function writeCmsBaseline(themeName) {
    const theme = getThemeDefinition(themeName);
    if (!theme?.src) return null;

    let contents = "[]";
    try {
        contents = await fs.readFile(path.join(CMS_CONTENT_DIR, CMS_CANDIDATES_FILE), "utf8");
    } catch {
        // the export was never run
    }

    const target = path.join(theme.src, OUTPUT_THEME_DIR, CMS_BASELINE_FILE);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, contents);

    return target;
}

export default writeCmsBaseline;
