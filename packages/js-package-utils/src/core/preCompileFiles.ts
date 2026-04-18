import path from "path";
import fs from "fs/promises";
import moduleResolver from "./moduleResolver.ts";
import {
    PRECOMPILED_FOLDER,
    ALL_JS_VUE_FILES_WITH_INHERITANCE_FILE_NAME,
} from "../config/default.ts";
import getCssImports from "./cssResolver.ts";
import configResolver from "./configResolver.ts";
import generateComponentTypes from "./generateComponentTypes.ts";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function writeToFile(outputPath, content) {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, content, "utf-8");
}

async function precompileCss(themeName) {
    const cssContent = await getCssImports(themeName);
    const outputPath = path.resolve(PRECOMPILED_FOLDER, themeName, "precompiled.css");
    await writeToFile(outputPath, cssContent);
}

async function precompileJs(themeName) {
    const baseJsPath = path.resolve(__dirname, "../templates/base_main_js_file.js");
    const jsOutputPath = path.resolve(PRECOMPILED_FOLDER, themeName, "precompiled.js");
    await fs.copyFile(baseJsPath, jsOutputPath);

    const vueFilesOutputPath = path.join(
        PRECOMPILED_FOLDER,
        themeName,
        ALL_JS_VUE_FILES_WITH_INHERITANCE_FILE_NAME,
    );
    const vueFiles = await moduleResolver.getAllJsVueFilesWithInheritance(themeName);
    await writeToFile(vueFilesOutputPath, JSON.stringify(vueFiles));
}

// Write the `Vendor_Module::` type declarations into the theme tree (gitignored)
// so the author's editor — which opens the theme sources directly — picks them
// up via the theme's jsconfig. Skipped silently if the theme has no src.
async function precompileDts(themeName) {
    const themeDefinition = configResolver.getThemeDefinition(themeName);
    if (!themeDefinition?.src) return;
    const content = await generateComponentTypes(themeName);
    const outputPath = path.join(themeDefinition.src, ".mage-obsidian", "components.d.ts");
    await writeToFile(outputPath, content);
}

export { precompileCss, precompileJs, precompileDts };
