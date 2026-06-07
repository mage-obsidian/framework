import path from "path";
import configResolver from "./configResolver.ts";
import {
    ALL_JS_VUE_FILES_WITH_INHERITANCE_FILE_NAME,
    MODULE_WEB_PATH,
    PRECOMPILED_FOLDER,
    THEME_MODULE_WEB_PATH,
} from "../config/default.ts";
import getFilesFromFolders from "../utils/findComponents.ts";
import fs from "fs";
import deepmerge from "deepmerge";

const defaultFoldersToMap = [
    {
        src: configResolver.getMagentoConfig().VUE_COMPONENTS_PATH,
        ext: ["vue", "ts", "js"],
    },
    {
        src: configResolver.getMagentoConfig().JS_PATH,
        ext: ["ts", "js"],
    },
];

// Keyed by `${theme}\0${contractHash}` so a changed module/theme set (new hash)
// recomputes instead of returning a result keyed only by theme name.
const cachedModulesByTheme = new Map();

// NUL separator: theme names and the hex hash never contain it, so the parts
// can't collide. Shared with invalidateTheme so its prefix match stays in
// lock-step with the key format (a plain space here silently broke the match).
const CACHE_KEY_SEP = "\0";
const cacheKey = (themeName) => `${themeName}${CACHE_KEY_SEP}${configResolver.getContractHash()}`;

// Caches the persisted inheritance map keyed by theme, invalidated by the file's
// mtime so a rebuilt .precompiled JSON (watch mode, regeneration) is picked up
// instead of serving a stale in-memory copy.
const precompiledFileCache = new Map();

async function getAllJsVueFilesFromActiveModules() {
    const result = {};
    for (const entry of configResolver.getModulesConfigArray()) {
        const [moduleName, moduleConfig] = entry;
        const moduleResult = await getFilesFromFolders(
            moduleName,
            path.resolve(moduleConfig.src, MODULE_WEB_PATH),
            defaultFoldersToMap,
        );
        Object.assign(result, moduleResult);
    }
    return result;
}

async function getAllJsVueFilesFromTheme(themeName) {
    let result = {};
    const theme = configResolver.getMagentoConfig().themes[themeName];
    if (!theme) {
        return {};
    }

    if (theme.parent) {
        result = await getAllJsVueFilesFromTheme(theme.parent);
    }

    for (const moduleName of configResolver.getAllMagentoModulesEnabled()) {
        const modulePath = path.resolve(theme.src, moduleName, THEME_MODULE_WEB_PATH);
        const moduleResult = await getFilesFromFolders(moduleName, modulePath, defaultFoldersToMap);
        if (moduleResult) {
            result = deepmerge(result, moduleResult);
        }
    }
    const moduleResult = await getFilesFromFolders(
        configResolver.getMagentoConfig().THEME_FILES_PATH,
        path.resolve(theme.src, THEME_MODULE_WEB_PATH),
        defaultFoldersToMap,
    );
    result = deepmerge(result, moduleResult);
    return result;
}

function getAllJsVueFilesWithInheritanceCached(themeName?) {
    themeName = themeName ?? process.env.CURRENT_THEME;
    const filePath = path.join(
        PRECOMPILED_FOLDER,
        themeName,
        ALL_JS_VUE_FILES_WITH_INHERITANCE_FILE_NAME,
    );
    const { mtimeMs } = fs.statSync(filePath);
    const cached = precompiledFileCache.get(themeName);
    if (cached && cached.mtimeMs === mtimeMs) {
        return cached.data;
    }
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    precompiledFileCache.set(themeName, { mtimeMs, data });
    return data;
}

async function getAllJsVueFilesWithInheritance(themeName?) {
    themeName = themeName ?? process.env.CURRENT_THEME;
    const key = cacheKey(themeName);
    if (cachedModulesByTheme.has(key)) {
        return cachedModulesByTheme.get(key);
    }
    const allJsVueFilesFromModules = await getAllJsVueFilesFromActiveModules();
    const allJsVueFilesFromThemes = await getAllJsVueFilesFromTheme(themeName);
    const merged = deepmerge(allJsVueFilesFromModules, allJsVueFilesFromThemes);
    cachedModulesByTheme.set(key, merged);
    return merged;
}

const moduleConfigByThemeCache = new Map();

// Drop every cached entry for a theme so the next resolution recomputes from
// disk. Adding or removing a component/js source changes neither the contract
// nor its hash, so the (theme, hash)-keyed caches would otherwise serve a stale
// map; the dev-server watcher calls this before regenerating on a source change.
function invalidateTheme(themeName?) {
    themeName = themeName ?? process.env.CURRENT_THEME;
    const prefix = `${themeName}${CACHE_KEY_SEP}`;
    for (const key of cachedModulesByTheme.keys()) {
        if (key.startsWith(prefix)) cachedModulesByTheme.delete(key);
    }
    for (const key of moduleConfigByThemeCache.keys()) {
        if (key.startsWith(prefix)) moduleConfigByThemeCache.delete(key);
    }
    precompiledFileCache.delete(themeName);
}

const MODULE_CONFIG_FILE = configResolver.getMagentoConfig().MODULE_CONFIG_FILE;

/**
 * Gets the theme configuration file path.
 * @param {string} moduleSrc
 * @returns {string} Full path to the configuration file.
 */
function getModuleConfigPath(moduleSrc) {
    return path.join(moduleSrc, "view/frontend/web/", MODULE_CONFIG_FILE);
}

function resolveFileByTheme(themeName, moduleName, filePath) {
    const theme = configResolver.getMagentoConfig().themes[themeName];
    const fullFilePath = path.join(theme.src, moduleName, "web", filePath);
    if (fs.existsSync(fullFilePath)) {
        return fullFilePath;
    }

    if (theme.parent) {
        return resolveFileByTheme(theme.parent, moduleName, filePath);
    }
    return null;
}

async function resolveModuleConfig(moduleName, themeName) {
    const module = configResolver.getMagentoConfig().modules[moduleName];
    let moduleConfigSourcePath = resolveFileByTheme(themeName, moduleName, MODULE_CONFIG_FILE);

    if (!moduleConfigSourcePath && !module) {
        return null;
    }
    if (!moduleConfigSourcePath) {
        moduleConfigSourcePath = getModuleConfigPath(module.src);
    }
    if (!fs.existsSync(moduleConfigSourcePath)) {
        return null;
    }

    // Importación dinámica común en ESModules
    const moduleConfig = await import(moduleConfigSourcePath);
    return moduleConfig.default ?? moduleConfig;
}

/**
 * Retrieves the Tailwind configuration for a theme synchronously.
 * Uses a cache system to optimize performance.
 * @param {string} themeName - Name of the theme.
 * @param {object} themeConfig
 * @returns {object|null} Tailwind configuration object.
 */
async function getModuleConfigByThemeConfig(themeName, themeConfig) {
    const key = cacheKey(themeName);
    if (moduleConfigByThemeCache.has(key)) {
        return moduleConfigByThemeCache.get(key);
    }
    if (!themeConfig) return null;
    const modules = configResolver.getAllMagentoModulesEnabled();
    let modulesConfig = {};

    for (const moduleName of modules) {
        const moduleConfig = await resolveModuleConfig(moduleName, themeName);
        if (!moduleConfig) continue;
        modulesConfig = deepmerge(modulesConfig, moduleConfig);
    }

    moduleConfigByThemeCache.set(key, modulesConfig);
    return modulesConfig;
}

export default {
    getAllJsVueFilesWithInheritance,
    getAllJsVueFilesWithInheritanceCached,
    getModuleConfigByThemeConfig,
    resolveFileByTheme,
    invalidateTheme,
};

export {
    getModuleConfigByThemeConfig,
    resolveFileByTheme,
    getAllJsVueFilesWithInheritance,
    getAllJsVueFilesWithInheritanceCached,
    invalidateTheme,
};
