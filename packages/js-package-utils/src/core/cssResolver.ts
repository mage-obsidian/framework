import themeResolver from "./themeResolverSync.ts";
import path from "node:path";
import {
    MODULE_TEMPLATES_PATH,
    MODULE_WEB_PATH,
    THEME_CSS_FOLDER,
    THEME_MODULE_WEB_PATH,
} from "../config/default.ts";
import { resolveFileByTheme, getAllJsVueFilesWithInheritanceCached } from "./moduleResolver.ts";
import configResolver from "./configResolver.ts";
import fs from "node:fs/promises";

const { getMagentoConfig, getModuleDefinition, getThemeDefinition, getModulesConfigArray } =
    configResolver;

const MODULE_CSS_EXTEND_FILE = getMagentoConfig().MODULE_CSS_EXTEND_FILE;
const THEME_CSS_SOURCE_FILE = getMagentoConfig().THEME_CSS_SOURCE_FILE;

async function getThemeImports(themeName, themeConfig?) {
    if (!themeConfig) {
        themeConfig = await themeResolver.getThemeConfig(themeName);
    }
    const themeDefinition = getThemeDefinition(themeName);
    const themePath = themeDefinition.src;

    let imports = "";
    if (themeConfig.includeCssSourceFromParentThemes && themeDefinition.parent) {
        imports += await getThemeImports(themeDefinition.parent, themeConfig);
    }

    imports += `@import "${path.join(themePath, THEME_MODULE_WEB_PATH, THEME_CSS_FOLDER, THEME_CSS_SOURCE_FILE)}";\n`;
    return imports;
}

function resolveModuleCssSourcePath(moduleName, themeName) {
    let moduleConfigSourcePath = resolveFileByTheme(
        themeName,
        moduleName,
        path.join("css", MODULE_CSS_EXTEND_FILE),
    );
    if (!moduleConfigSourcePath) {
        const moduleDefinition = getModuleDefinition(moduleName);
        moduleConfigSourcePath = path.join(
            moduleDefinition.src,
            MODULE_WEB_PATH,
            "css",
            MODULE_CSS_EXTEND_FILE,
        );
    }
    return moduleConfigSourcePath;
}

// Walk the theme -> parent chain emitting a @source for each theme root so
// Tailwind scans the Twig/phtml templates of every theme in the inheritance
// chain (a child theme's classes plus everything it inherits unchanged).
async function getThemeTemplateSources(themeName) {
    const theme = getThemeDefinition(themeName);
    if (!theme) return "";

    let sources = "";
    if (theme.parent) {
        sources += await getThemeTemplateSources(theme.parent);
    }
    sources += `@source "${theme.src}";\n`;
    return sources;
}

// Reads the source-scan opt-out: a theme (merged with its parents) lists the
// modules whose files Tailwind must NOT scan via `ignoredTailwindConfigFromModules`
// in theme.config.js — an array of module names, or "all" to skip every module.
// The theme's own files are always scanned.
async function getScanExclusions(themeName) {
    const themeConfig = await themeResolver.getThemeConfig(themeName);
    const ignored = themeConfig?.ignoredTailwindConfigFromModules;
    return {
        ignoreAllModules: ignored === "all",
        excludedModules: new Set(Array.isArray(ignored) ? ignored : []),
    };
}

// Templates (.twig/.phtml) are not auto-scanned by Tailwind in this pipeline
// (its base path is the Vite root, not the Magento tree), and the engine only
// emits @source for JS/Vue components. This registers the template dirs of
// every compatible module plus the whole theme inheritance chain, mirroring how
// components already resolve module + parent-theme sources, and honours the
// per-module scan opt-out.
async function getTemplateSources(themeName) {
    const { ignoreAllModules, excludedModules } = await getScanExclusions(themeName);
    let sources = "";

    if (!ignoreAllModules) {
        for (const [moduleName, moduleConfig] of getModulesConfigArray()) {
            if (excludedModules.has(moduleName)) continue;
            const templatesDir = path.join(moduleConfig.src, MODULE_TEMPLATES_PATH);
            try {
                await fs.access(templatesDir);
                sources += `@source "${templatesDir}";\n`;
            } catch {
                // module ships no frontend templates
            }
        }
    }

    sources += await getThemeTemplateSources(themeName);
    return sources;
}

async function getVueComponentsSource(themeName) {
    const { ignoreAllModules, excludedModules } = await getScanExclusions(themeName);
    const vueComponents = await getAllJsVueFilesWithInheritanceCached(themeName);
    // Inheritance keys look like "Vendor_Module/components/X" or "Theme/...";
    // "Theme" entries are the theme's own files and are always scanned.
    const vueComponentSources = Object.entries(vueComponents)
        .filter(([key]) => {
            const owner = key.split("/")[0];
            if (owner === "Theme") return true;
            if (ignoreAllModules) return false;
            return !excludedModules.has(owner);
        })
        .map(([, url]) => `@source "${url}";\n`);
    return vueComponentSources.join("");
}

async function getCssImports(themeName) {
    const themeConfig = await themeResolver.getThemeConfig(themeName);
    const excludedModules = new Set(themeConfig.ignoredCssFromModules || []);
    const modulesConfig = getModulesConfigArray();

    const cssSource = await getVueComponentsSource(themeName);
    let cssImports = "";

    if (themeConfig.ignoredCssFromModules !== "all") {
        for (const [moduleName] of modulesConfig) {
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

    const templateSources = await getTemplateSources(themeName);
    return `${cssSource}${templateSources}\n${cssImports}`;
}

export default getCssImports;
export { getTemplateSources };
