const themeResolver = require('./themeResolverSync.cjs');
const moduleResolver = require('./moduleResolverSync.cjs');
const deepmerge = require('deepmerge');

function getTailwindConfigByTheme(themeName) {
    const themeConfig = themeResolver.getThemeConfig(themeName);
    return deepmerge(
        moduleResolver.getModuleConfigByThemeConfig(themeName, themeConfig)?.tailwind ?? {},
        themeConfig?.tailwind ?? {}
    );
}

module.exports = {
    getTailwindConfigByTheme
};
