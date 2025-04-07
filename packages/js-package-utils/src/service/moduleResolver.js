import path from "path";
import configResolver from "./configResolver.js";
import {
    ALL_JS_VUE_FILES_WITH_INHERITANCE_FILE_NAME,
    MODULE_WEB_PATH,
    PRECOMPILED_FOLDER,
    THEME_MODULE_WEB_PATH
} from "../config/default.js";
import getFilesFromFolders from '../utils/findComponents.js'
import fs from "fs";
import deepmerge from "deepmerge";

const defaultFoldersToMap = [
    {
        src: configResolver.getMagentoConfig().VUE_COMPONENTS_PATH,
        ext: [
            'vue',
            'js'
        ]
    },
    {
        src: configResolver.getMagentoConfig().JS_PATH,
        ext: [
            'js'
        ]
    }
];

const cachedModulesByTheme = {};

async function getAllJsVueFilesFromActiveModules() {
    let result = {};
    for (const entry of configResolver.getModulesConfigArray()) {
        const [moduleName, moduleConfig] = entry;
        const moduleResult = await getFilesFromFolders(
            moduleName,
            path.resolve(moduleConfig.src, MODULE_WEB_PATH),
            defaultFoldersToMap
        );
        Object.assign(result, moduleResult);
    }
    return result;
}

async function getAllJsVueFilesFromTheme(themeName) {
    let result = {};
    const theme = configResolver.getMagentoConfig().themes[themeName];
    if (!theme) {
        return {}
    }

    if (theme.parent) {
        result = await getAllJsVueFilesFromTheme(theme.parent)
    }

    for (const moduleName of configResolver.getAllMagentoModulesEnabled()) {
        const modulePath = path.resolve(theme.src, moduleName, THEME_MODULE_WEB_PATH);
        const moduleResult = await getFilesFromFolders(
            moduleName,
            modulePath,
            defaultFoldersToMap
        );
        if (moduleResult) {
            result = deepmerge(result, moduleResult);
        }
    }
    const moduleResult = await getFilesFromFolders(
        'Theme',
        path.resolve(theme.src, THEME_MODULE_WEB_PATH),
        defaultFoldersToMap
    );
    result = deepmerge(result, moduleResult);
    return result;
}


function getAllJsVueFilesWithInheritanceCached(themeName) {
    themeName = themeName ?? process.env.CURRENT_THEME;
    if (cachedModulesByTheme[themeName]) {
        return cachedModulesByTheme[themeName];
    }
    const filePath = path.join(PRECOMPILED_FOLDER, themeName, ALL_JS_VUE_FILES_WITH_INHERITANCE_FILE_NAME);
    const fileContent = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(fileContent);
    cachedModulesByTheme[themeName] = data;
    return data;
}

async function getAllJsVueFilesWithInheritance(themeName) {
    themeName = themeName ?? process.env.CURRENT_THEME;
    if (cachedModulesByTheme[themeName]) {
        return cachedModulesByTheme[themeName];
    }
    const allJsVueFilesFromModules = await getAllJsVueFilesFromActiveModules();
    const allJsVueFilesFromThemes = await getAllJsVueFilesFromTheme(themeName);
    cachedModulesByTheme[themeName] = deepmerge(allJsVueFilesFromModules, allJsVueFilesFromThemes);
    return cachedModulesByTheme[themeName];
}

const moduleConfigByThemeCache = new Map();

const MODULE_CONFIG_FILE = configResolver.getMagentoConfig().MODULE_CONFIG_FILE;

/**
 * Gets the theme configuration file path.
 * @param {string} moduleSrc
 * @returns {string} Full path to the configuration file.
 */
function getModuleConfigPath(moduleSrc) {
    return path.join(moduleSrc, 'view/frontend/web/', MODULE_CONFIG_FILE);
}

function resolveFileByTheme(themeName, moduleName, filePath, includeTailwindConfigFromParentThemes) {
    const theme = configResolver.getMagentoConfig().themes[themeName];
    const fullFilePath = path.join(theme.src, moduleName, 'web', filePath);
    if (fs.existsSync(fullFilePath)) {
        return fullFilePath;
    }

    if (includeTailwindConfigFromParentThemes && theme.parent) {
        return resolveFileByTheme(theme.parent, moduleName, filePath, includeTailwindConfigFromParentThemes);
    }
    return null;
}

async function resolveModuleConfig(moduleName, themeName, includeTailwindConfigFromParentThemes) {
    const module = configResolver.getMagentoConfig().modules[moduleName];
    let moduleConfigSourcePath = resolveFileByTheme(themeName, moduleName, MODULE_CONFIG_FILE, includeTailwindConfigFromParentThemes);

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
    if (moduleConfigByThemeCache.has(themeName)) {
        return moduleConfigByThemeCache.get(themeName);
    }
    if (!themeConfig) return null;
    const modules = configResolver.getAllMagentoModulesEnabled();
    let modulesConfig = {};

    for (const moduleName of modules) {
        let moduleConfig = await resolveModuleConfig(moduleName, themeName, themeConfig.includeTailwindConfigFromParentThemes);
        if (!moduleConfig) continue;
        if (
            themeConfig.ignoredTailwindConfigFromModules === 'all' ||
            themeConfig.ignoredTailwindConfigFromModules.includes(moduleName)
        ) {
            moduleConfig.tailwind = {};
        } else if (moduleConfig.tailwind?.content) {
            const moduleSrc = configResolver.getMagentoConfig().modules[moduleName].src;
            moduleConfig.tailwind.content = moduleConfig.tailwind.content.map((content) =>
                path.join(moduleSrc, 'view/frontend/web', content)
            );
        }

        modulesConfig = deepmerge(modulesConfig, moduleConfig);
    }

    moduleConfigByThemeCache.set(themeName, modulesConfig);
    return modulesConfig;
}

export default {
    getAllJsVueFilesWithInheritance,
    getAllJsVueFilesWithInheritanceCached,
    getModuleConfigByThemeConfig,
    resolveFileByTheme
};

export { getModuleConfigByThemeConfig, resolveFileByTheme };

