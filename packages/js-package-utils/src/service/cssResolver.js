import themeResolver from './themeResolverSync.js';
import path from 'node:path';
import { MODULE_WEB_PATH, THEME_CSS_FOLDER, THEME_MODULE_WEB_PATH } from '../config/default.js';
import { resolveFileByTheme, getAllJsVueFilesWithInheritanceCached } from './moduleResolver.js';
import configResolver from './configResolver.js';
import fs from 'node:fs/promises';

const { getMagentoConfig, getModuleDefinition, getThemeDefinition, getModulesConfigArray } = configResolver;

const MODULE_CSS_EXTEND_FILE = getMagentoConfig().MODULE_CSS_EXTEND_FILE;
const THEME_CSS_SOURCE_FILE = getMagentoConfig().THEME_CSS_SOURCE_FILE;

async function getThemeImports(themeName, themeConfig) {
    if (!themeConfig) {
        themeConfig = themeResolver.getThemeConfig(themeName);
    }
    const themeDefinition = getThemeDefinition(themeName);
    const themePath = themeDefinition.src;

    let imports = '';
    if (themeConfig.includeCssSourceFromParentThemes && themeDefinition.parent) {
        imports += await getThemeImports(themeDefinition.parent, themeConfig);
    }

    imports += `@import "${path.join(themePath, THEME_MODULE_WEB_PATH, THEME_CSS_FOLDER, THEME_CSS_SOURCE_FILE)}";\n`;
    return imports;
}

function resolveModuleCssSourcePath(moduleName, themeName) {
    let moduleConfigSourcePath = resolveFileByTheme(themeName, moduleName, 'css', MODULE_CSS_EXTEND_FILE);
    if (!moduleConfigSourcePath) {
        const moduleDefinition = getModuleDefinition(moduleName);
        moduleConfigSourcePath = path.join(moduleDefinition.src, MODULE_WEB_PATH, 'css', MODULE_CSS_EXTEND_FILE);
    }
    return moduleConfigSourcePath;
}

async function getVueComponentsSource(themeName) {
    const vueComponents = await getAllJsVueFilesWithInheritanceCached(themeName);
    // split with @source al inicio
    const vueComponentSources = Object.entries(vueComponents).map(([name, url]) => {
        return `@source "${url}";\n`;
    })
    return vueComponentSources.join('');
}

async function getCssImports(themeName) {
    const themeConfig = themeResolver.getThemeConfig(themeName);
    const excludedModules = new Set(themeConfig.ignoredCssFromModules || []);
    const modulesConfig = getModulesConfigArray();

    let cssSource = await getVueComponentsSource(themeName);
    let cssImports = '';

    if (themeConfig.ignoredCssFromModules !== 'all') {
        for (const [moduleName, moduleConfig] of modulesConfig) {
            if (excludedModules.has(moduleName)) continue;

            const filePath = resolveModuleCssSourcePath(moduleName, themeName);
            try {
                await fs.access(filePath);
                cssImports += `@import "${filePath}";\n`;
            } catch {
                // ignore if file doesn't exist
            }
        }
    }

    cssImports += await getThemeImports(themeName);
    return `${cssSource}\n${cssImports}`;
}

export default getCssImports;
