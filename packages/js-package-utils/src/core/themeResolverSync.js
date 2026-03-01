import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import deepmerge from "deepmerge";
import { THEME_MODULE_WEB_PATH } from "../config/default.js";
import configResolver from "./configResolver.js";

const themeConfigCache = new Map();
const themeConfigPlainCache = new Map();

function getThemeConfigPath(themeSrc) {
  return path.join(
    themeSrc,
    THEME_MODULE_WEB_PATH,
    configResolver.getMagentoConfig().THEME_CONFIG_FILE
  );
}

async function loadThemeConfig(themeDefinition, themeName) {
  if (!themeDefinition) return null;
  if (themeConfigPlainCache.has(themeName)) return themeConfigPlainCache.get(themeName);

  try {
    const configPath = getThemeConfigPath(themeDefinition.src);
    fs.accessSync(configPath, fs.constants.F_OK);

    let themeConfig = await import(pathToFileUrl(configPath));
    themeConfig = themeConfig.default ?? themeConfig;

    themeConfigPlainCache.set(themeName, themeConfig);
    return deepmerge({}, themeConfig);
  } catch (error) {
    console.error(`Failed to load configuration for theme "${themeName}":`, error.message);
    return null;
  }
}

function pathToFileUrl(filePath) {
  const resolvedPath = path.resolve(filePath);
  const fileUrl = new URL(`file://${resolvedPath}`);
  return fileUrl.href;
}

export async function getThemeConfig(themeName) {
  if (themeConfigCache.has(themeName)) return themeConfigCache.get(themeName);

  const themeDefinition = configResolver.getMagentoConfig().themes[themeName];
  if (!themeDefinition) return null;

  let themeConfig = await loadThemeConfig(themeDefinition, themeName);
  if (!themeConfig) return null;

  themeConfig.includeCssSourceFromParentThemes ??= true;
  themeConfig.ignoredCssFromModules ??= [];
  themeConfig.exposeNpmPackages ??= [];
  if (themeDefinition.parent) {
    const parentConfig = await getThemeConfig(themeDefinition.parent);
    themeConfig = deepmerge(parentConfig || {}, themeConfig);
  }
  themeConfigCache.set(themeName, themeConfig);
  return themeConfig;
}

// Export default con todo
export default {
  getThemeConfig
};
