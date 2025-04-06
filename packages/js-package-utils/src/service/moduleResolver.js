import path from "path";
import configResolver from "./configResolver.js";
import {
    ALL_JS_VUE_FILES_WITH_INHERITANCE_FILE_NAME,
    MODULE_WEB_PATH,
    PRECOMPILED_FOLDER,
    THEME_MODULE_WEB_PATH
} from "../config/default.js";
import getFilesFromFolders from '../utils/findComponents.js'
import fs from "fs";
import deepmerge from "deepmerge";

const defaultFoldersToMap = [
    {
        src: configResolver.getMagentoConfig().VUE_COMPONENTS_PATH,
        ext: [
            'vue',
            'js'
        ]
    },
    {
        src: configResolver.getMagentoConfig().JS_PATH,
        ext: [
            'js'
        ]
    }
];

const cachedModulesByTheme = {};

async function getAllJsVueFilesFromActiveModules() {
    let result = {};
    for (const entry of configResolver.getModulesConfigArray()) {
        const [moduleName, moduleConfig] = entry;
        const moduleResult = await getFilesFromFolders(
            moduleName,
            path.resolve(moduleConfig.src, MODULE_WEB_PATH),
            defaultFoldersToMap
        );
        Object.assign(result, moduleResult);
    }
    return result;
}

async function getAllJsVueFilesFromTheme(themeName) {
    let result = {};
    const theme = configResolver.getMagentoConfig().themes[themeName];
    if (!theme) {
        return {}
    }

    if (theme.parent) {
        result = await getAllJsVueFilesFromTheme(theme.parent)
    }

    for (const moduleName of configResolver.getAllMagentoModulesEnabled()) {
        const modulePath = path.resolve(theme.src, moduleName, THEME_MODULE_WEB_PATH);
        const moduleResult = await getFilesFromFolders(
            moduleName,
            modulePath,
            defaultFoldersToMap
        );
        if (moduleResult) {
            result = deepmerge(result, moduleResult);
        }
    }
    const moduleResult = await getFilesFromFolders(
        'Theme',
        path.resolve(theme.src, THEME_MODULE_WEB_PATH),
        defaultFoldersToMap
    );
    result = deepmerge(result, moduleResult);
    return result;
}


function getAllJsVueFilesWithInheritanceCached(themeName) {
    themeName = themeName ?? process.env.CURRENT_THEME;
    if (cachedModulesByTheme[themeName]) {
        return cachedModulesByTheme[themeName];
    }
    const filePath = path.join(PRECOMPILED_FOLDER, themeName, ALL_JS_VUE_FILES_WITH_INHERITANCE_FILE_NAME);
    const fileContent = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(fileContent);
    cachedModulesByTheme[themeName] = data;
    return data;
}

async function getAllJsVueFilesWithInheritance(themeName) {
    themeName = themeName ?? process.env.CURRENT_THEME;
    if (cachedModulesByTheme[themeName]) {
        return cachedModulesByTheme[themeName];
    }
    const allJsVueFilesFromModules = await getAllJsVueFilesFromActiveModules();
    const allJsVueFilesFromThemes = await getAllJsVueFilesFromTheme(themeName);
    cachedModulesByTheme[themeName] = deepmerge(allJsVueFilesFromModules, allJsVueFilesFromThemes);
    return cachedModulesByTheme[themeName];
}

export default {
    getAllJsVueFilesWithInheritance,
    getAllJsVueFilesWithInheritanceCached
};
