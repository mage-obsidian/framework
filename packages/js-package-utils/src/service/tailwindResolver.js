import themeResolver from './themeResolverSync.js';
import moduleResolver from './moduleResolverSync.js';
import deepmerge from 'deepmerge';

export function getTailwindConfigByTheme(themeName) {
    const themeConfig = themeResolver.getThemeConfig(themeName);
    return deepmerge(
        moduleResolver.getModuleConfigByThemeConfig(themeName, themeConfig)?.tailwind ?? {},
        themeConfig?.tailwind ?? {}
    );
}
