import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DEPENDENCY_CONFIG_FILE_PATH, OUTPUT_THEME_DIR } from "../config/default.js";
import { validateContract } from "./contractValidator.js";

const REGENERATE_HINT =
    "Try running `bin/magento mage-obsidian:frontend:config --generate` to generate the configuration file.";

// Cached contract, invalidated by the file's mtime. A per-process `const` read
// at import time never picked up a regenerated contract (e.g. a module enabled
// while a long-lived dev server runs), so caches keyed only by theme served
// stale results. Reloading on mtime change makes the contract — and the hash
// derived from it — track the file.
let cached = null; // { mtimeMs, config, hash }

function fail(message, extra = []) {
    console.error(message);
    extra.forEach((line) => console.error(line));
    console.error(REGENERATE_HINT);
    process.exit(1);
}

function loadContract() {
    let stats;
    try {
        stats = fs.statSync(DEPENDENCY_CONFIG_FILE_PATH);
    } catch (error) {
        fail(
            `Error reading configuration file at ${DEPENDENCY_CONFIG_FILE_PATH}: ${error.message}`,
        );
    }

    if (cached && cached.mtimeMs === stats.mtimeMs) {
        return cached.config;
    }

    let config;
    try {
        config = JSON.parse(fs.readFileSync(DEPENDENCY_CONFIG_FILE_PATH, "utf-8"));
    } catch (error) {
        fail(
            `Error reading or parsing configuration file at ${DEPENDENCY_CONFIG_FILE_PATH}: ${error.message}`,
        );
    }

    const validation = validateContract(config);
    if (!validation.ok) {
        fail(`Invalid MageObsidian frontend contract at ${DEPENDENCY_CONFIG_FILE_PATH}:`, [
            ...validation.errors.map((message) => `  - ${message}`),
            "If the version differs, the PHP module and JS engine are out of sync — align their versions, then regenerate.",
        ]);
    }

    // Hash the parts that change the build graph (which modules/themes exist and
    // their resolution). Caches downstream key on this so a changed module set
    // invalidates them, rather than serving a result keyed only by theme name.
    const hash = crypto
        .createHash("sha1")
        .update(
            JSON.stringify({
                modules: config.modules,
                themes: config.themes,
                allModules: config.allModules,
            }),
        )
        .digest("hex");

    cached = { mtimeMs: stats.mtimeMs, config, hash };
    return config;
}

const getContract = () => loadContract();

export const getMagentoConfig = () => getContract();
export const getContractHash = () => {
    getContract();
    return cached.hash;
};
export const getModulesConfigArray = () => Object.entries(getContract().modules);
export const getThemesConfigArray = () => Object.entries(getContract().themes);
export const getAllMagentoModulesEnabled = () => getContract().allModules;
export const isDev = () => getContract().mode !== "production";

export const getOutputDirFromTheme = (themePath) => path.resolve(themePath, OUTPUT_THEME_DIR);

export const getModuleDefinition = (moduleName) => getContract().modules[moduleName];

export const getThemeDefinition = (themeName) => getContract().themes[themeName];

export const MODE = process.env.NODE_ENV;

export function resolveLibPath(lib) {
    return path.join(getContract().LIB_PATH, lib);
}

export function resolveNodePath(packageName) {
    try {
        const resolvedPath = import.meta.resolve(packageName);
        return resolvedPath.replace("file://", "");
    } catch (error) {
        console.error(`The package ${packageName} can't be resolved.`);
        throw error;
    }
}

export function resolveLibRealPath(lib) {
    return MODE === "production" ? lib : resolveNodePath(lib);
}

export default {
    getMagentoConfig,
    getContractHash,
    getModulesConfigArray,
    getThemesConfigArray,
    getAllMagentoModulesEnabled,
    isDev,
    getOutputDirFromTheme,
    getModuleDefinition,
    getThemeDefinition,
    resolveLibPath,
    resolveNodePath,
    resolveLibRealPath,
};
