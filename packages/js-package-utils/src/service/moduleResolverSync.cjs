const path = require("path");
const fs = require("fs");
const deepmerge = require("deepmerge");
const configResolver = require("./configResolver.cjs");

const moduleConfigByThemeCache = new Map();

const MODULE_CONFIG_FILE = configResolver.getMagentoConfig().MODULE_CONFIG_FILE;

/**
 * Gets the theme configuration file path.
 * @returns {string} Full path to the configuration file.
 * @param moduleSrc
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

function resolveModuleConfig(moduleName, themeName, includeTailwindConfigFromParentThemes) {
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
    return require(moduleConfigSourcePath);
}

/**
 * Retrieves the Tailwind configuration for a theme synchronously.
 * Uses a cache system to optimize performance.
 * @param {string} themeName - Name of the theme.
 * @returns {object|null} Tailwind configuration object.
 */
function getModuleConfigByThemeConfig(themeName, themeConfig) {
    if (moduleConfigByThemeCache.has(themeName)) {
        return moduleConfigByThemeCache.get(themeName);
    }
    if (!themeConfig) return null;
    const modules = configResolver.getAllMagentoModulesEnabled();

    let modulesConfig = {};

    for(const moduleName of modules) {
        let moduleConfig = resolveModuleConfig(moduleName, themeName, themeConfig.includeTailwindConfigFromParentThemes);
        if (!moduleConfig) {
            continue;
        }
        if (themeConfig.ignoredTailwindConfigFromModules === 'all' || themeConfig.ignoredTailwindConfigFromModules.includes(moduleName)) {
            moduleConfig.tailwind = {};
        } else if (moduleConfig.tailwind && moduleConfig.tailwind.content) {
            const moduleSrc = configResolver.getMagentoConfig().modules[moduleName].src;
            moduleConfig.tailwind.content = moduleConfig.tailwind.content.map((content) =>
                path.join(moduleSrc, 'view/frontend/web', content)
            );
        }
        modulesConfig = deepmerge(modulesConfig, moduleConfig);
    }
    return modulesConfig;
}

module.exports = {
    getModuleConfigByThemeConfig,
    resolveFileByTheme
};
