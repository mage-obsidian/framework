import path from 'node:path';
import fs from 'node:fs';
import deepmerge from 'deepmerge';
import configResolver from './configResolver.js';

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

export { getModuleConfigByThemeConfig, resolveFileByTheme };

export default {
    getModuleConfigByThemeConfig,
    resolveFileByTheme
};
