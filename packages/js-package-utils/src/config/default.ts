import path from "node:path";

// The Vite harness runs from the `vite/` dir one level below the Magento root.
// Allow an explicit root override so the engine is not tied to that cwd layout
// (e.g. when invoked from elsewhere or in tests).
export const MAGENTO_ROOT = process.env.MAGE_OBSIDIAN_MAGENTO_ROOT
    ? path.resolve(process.env.MAGE_OBSIDIAN_MAGENTO_ROOT)
    : path.resolve(process.cwd(), "..");

export const DEPENDENCY_CONFIG_FILENAME = "mage_obsidian_frontend_modules.json";
export const MAGENTO_CONFIG_RELATIVE_PATH = "app/etc/";
export const DEPENDENCY_CONFIG_FILE_PATH = path.resolve(
    MAGENTO_ROOT,
    MAGENTO_CONFIG_RELATIVE_PATH,
    DEPENDENCY_CONFIG_FILENAME,
);

export const MODULE_WEB_PATH = "view/frontend/web/";
export const MODULE_TEMPLATES_PATH = "view/frontend/templates";
export const THEME_MODULE_WEB_PATH = "web/";
export const MODULE_CSS_FOLDER = "css";

export const THEME_CSS_FOLDER = "css";

export const OUTPUT_THEME_DIR = "web/generated";
export const OUTPUT_JS_DIR = "js/";
export const OUTPUT_CSS_DIR = "css/";
export const PRECOMPILED_FOLDER = ".precompiled";
export const INTERCEPTORS_FOLDER = "interceptors";

export const ALL_JS_VUE_FILES_WITH_INHERITANCE_FILE_NAME = "allJsVueFilesWithInheritance.json";
