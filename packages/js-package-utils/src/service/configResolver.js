import fs from 'node:fs';
import path from 'node:path';
import { DEPENDENCY_CONFIG_FILE_PATH, OUTPUT_THEME_DIR } from '../config/default.js';

let MAGENTO_CONFIG;

try {
    const magentoConfigJson = fs.readFileSync(DEPENDENCY_CONFIG_FILE_PATH, 'utf-8');
    MAGENTO_CONFIG = JSON.parse(magentoConfigJson);
} catch (error) {
    console.error(`Error reading or parsing configuration file at ${DEPENDENCY_CONFIG_FILE_PATH}:`, error.message);
    console.error('Try running `devcore:frontend:config --generate` to generate the configuration file.');
    process.exit(1);
}

export const getMagentoConfig = () => MAGENTO_CONFIG;

export const getModulesConfigArray = () => Object.entries(MAGENTO_CONFIG.modules);
export const getThemesConfigArray = () => Object.entries(MAGENTO_CONFIG.themes);
export const getAllMagentoModulesEnabled = () => MAGENTO_CONFIG.allModules;
export const isDev = () => MAGENTO_CONFIG.mode !== 'production';

export const getOutputDirFromTheme = (themePath) =>
    path.resolve(themePath, OUTPUT_THEME_DIR);

export const getModuleDefinition = (moduleName) =>
    MAGENTO_CONFIG.modules[moduleName];

export const getThemeDefinition = (themeName) =>
    MAGENTO_CONFIG.themes[themeName];

export default {
    getMagentoConfig,
    getModulesConfigArray,
    getThemesConfigArray,
    getAllMagentoModulesEnabled,
    isDev,
    getOutputDirFromTheme,
    getModuleDefinition,
    getThemeDefinition
};