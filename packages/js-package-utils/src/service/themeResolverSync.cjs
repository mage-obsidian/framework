const path = require("path");
const fs = require("fs");
const deepmerge = require("deepmerge");
const { THEME_MODULE_WEB_PATH } = require("../config/default.cjs");
const configResolver = require("./configResolver.cjs");

const themeConfigCache = new Map();

function getThemeConfigPath(themeSrc) {
    return path.join(themeSrc, THEME_MODULE_WEB_PATH, configResolver.getMagentoConfig().THEME_CONFIG_FILE);
}

const themeConfigPlainCache = new Map();
function loadThemeConfig(themeDefinition, themeName) {
    if (!themeDefinition) return null;
    if (themeConfigPlainCache.has(themeName)) return themeConfigPlainCache.get(themeName);

    try {
        const configPath = getThemeConfigPath(themeDefinition.src);
        fs.accessSync(configPath, fs.constants.F_OK);
        let themeConfig = require(configPath);
        themeConfig = themeConfig.default ?? themeConfig;
        themeConfigPlainCache.set(themeName, themeConfig);
        return deepmerge({}, themeConfig);
    } catch {
        console.error(`Failed to load configuration for theme "${themeName}"`);
        return null;
    }
}

function getThemeConfig(themeName) {
    if (themeConfigCache.has(themeName)) return themeConfigCache.get(themeName);

    const themeDefinition = configResolver.getMagentoConfig().themes[themeName];
    if (!themeDefinition) return null;

    let themeConfig = loadThemeConfig(themeDefinition, themeName);
    if (!themeConfig) return null;
    if (themeConfig.includeTailwindConfigFromParentThemes === undefined) {
        themeConfig.includeTailwindConfigFromParentThemes = true;
    }
    if (themeConfig.includeCssSourceFromParentThemes === undefined) {
        themeConfig.includeCssSourceFromParentThemes = true;
    }
    if (themeConfig.ignoredCssFromModules === undefined) {
        themeConfig.ignoredCssFromModules = [];
    }
    if (themeConfig.ignoredTailwindConfigFromModules === undefined) {
        themeConfig.ignoredTailwindConfigFromModules = [];
    }
    if (themeConfig.exposeNpmPackages === undefined) {
        themeConfig.exposeNpmPackages = [];
    }
    if (themeConfig.tailwind === undefined) {
        themeConfig.tailwind = {};
    }


    if (themeConfig.tailwind?.content) {
        themeConfig.tailwind.content = themeConfig.tailwind.content.map((content) =>
            path.join(themeDefinition.src, "web", content)
        );
    }
    const includeTailwindConfigFromParentThemes = themeConfig.includeTailwindConfigFromParentThemes !== undefined ? themeConfig.includeTailwindConfigFromParentThemes : true;
    if (includeTailwindConfigFromParentThemes && themeDefinition.parent) {
        themeConfig = deepmerge(getThemeConfig(themeDefinition.parent) || {}, themeConfig);
    }

    themeConfigCache.set(themeName, themeConfig);
    return themeConfig;
}

function getTailwindThemeConfig(themeName) {
    return getThemeConfig(themeName)?.tailwind ?? {};
}

module.exports = {
    getThemeConfig,
    getTailwindThemeConfig
};
