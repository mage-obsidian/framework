import inheritModuleResolver from "./inheritModuleResolver.js";
import inheritAssetsModuleResolver from "./inheritAssetsModuleResolver.js";
import defaultNodeResolve from "./defaultNodeResolver.js";
import preCompileMagentoFiles from "../core/preCompileMagentoFiles.js";
import configResolver from "../core/configResolver.js";

/**
 * The framework's module-resolution plugin chain: `Vendor_Module::` component
 * and asset resolution plus the node-package fallback. Resolution order is
 * governed by each plugin's resolveId `order` ('pre'/'post'), not by array
 * position, so this group can sit anywhere in a consumer's plugin list.
 *
 * Shared so the dev/build config, component tests, auto-import and the
 * playground all resolve imports through the exact same chain instead of each
 * reimplementing it and drifting.
 */
export function getResolverPlugins() {
    return [
        inheritModuleResolver(),
        inheritAssetsModuleResolver(),
        defaultNodeResolve,
    ];
}

/**
 * Ensure a theme's precompiled entries exist on disk before a build/test/story
 * run. Idempotent per (theme, contract hash). Any consumer that resolves
 * `Vendor_Module::` imports MUST call this first: without it the resolver map
 * is empty and those imports resolve to undefined with no error.
 */
export function ensurePrecompiled(themeName) {
    return preCompileMagentoFiles(themeName);
}

/**
 * Build Vite's `server.fs.allow` list from the contract. Modules and themes can
 * live outside the Magento root — e.g. symlinked from a monorepo during dev —
 * in which case their real `src` roots are outside the default allow-list and
 * Vite answers 403 for any file under them. A single 403 on a bootstrap module
 * (such as the i18n runtime) aborts the whole ESM graph, so the page renders
 * unstyled with no components. Deriving the list from each module/theme `src`
 * makes the dev server serve sources wherever they physically live.
 */
export function getFsAllowList(rootDir) {
    const srcRoots = [
        ...configResolver.getModulesConfigArray(),
        ...configResolver.getThemesConfigArray(),
    ]
        .map(([, definition]) => definition?.src)
        .filter(Boolean);
    return [...new Set([rootDir, ...srcRoots])];
}
