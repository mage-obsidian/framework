import path from "node:path";
import fs from "node:fs/promises";
import { precompileCss, precompileJs, precompileJsconfig } from "./preCompileFiles.ts";
import configResolver from "./configResolver.ts";
import { PRECOMPILED_FOLDER } from "../config/default.ts";

// Guard per (theme, contract hash): repeated calls within one process (Vite
// re-invokes the config) skip the work, while a different theme — or the same
// theme after the contract changed (e.g. a module enabled/disabled mid dev
// server) — re-precompiles. Keying on the hash, not just the theme name, makes
// the invalidation dimension explicit instead of relying on process isolation.
const precompiledByTheme = new Map();

export default async (themeName) => {
    const contractHash = configResolver.getContractHash();
    if (precompiledByTheme.get(themeName) === contractHash) {
        return;
    }
    const themeDir = path.resolve(PRECOMPILED_FOLDER, themeName);
    // Clean only this theme's output. The old `rm -rf .precompiled/*` wiped
    // every theme, which would corrupt a concurrent or sibling-theme build.
    await fs.rm(themeDir, { recursive: true, force: true });
    await fs.mkdir(themeDir, { recursive: true });
    await precompileJs(themeName);
    await precompileCss(themeName);
    await precompileJsconfig(themeName);
    precompiledByTheme.set(themeName, contractHash);
};
