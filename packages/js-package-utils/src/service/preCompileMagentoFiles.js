import path from "node:path";
import fs from "node:fs/promises";
import { precompileCss, precompileJs } from "./preCompileFiles.js";
import { PRECOMPILED_FOLDER } from "../config/default.js";

// Guard per theme: repeated calls within one process (Vite re-invokes the
// config) skip the work, while different themes each precompile — so a future
// in-process multi-theme run is safe. Replaces the old module-global flag.
const precompiledThemes = new Set();

export default async (themeName) => {
    if (precompiledThemes.has(themeName)) {
        return;
    }
    const themeDir = path.resolve(PRECOMPILED_FOLDER, themeName);
    // Clean only this theme's output. The old `rm -rf .precompiled/*` wiped
    // every theme, which would corrupt a concurrent or sibling-theme build.
    await fs.rm(themeDir, { recursive: true, force: true });
    await fs.mkdir(themeDir, { recursive: true });
    await precompileJs(themeName);
    await precompileCss(themeName);
    precompiledThemes.add(themeName);
};
