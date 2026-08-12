import path from "path";
import configResolver from "../core/configResolver.ts";
import { getThemeChain } from "../core/themeChain.ts";
import fs from "fs";

export default function customAssetsResolverPlugin() {
    const CURRENT_THEME = process.env.CURRENT_THEME;
    const THEME_ASSETS_PATH = "web";
    const MODULE_ASSETS_PATH = "view/frontend/web";

    function tryResolveAssetPathByTheme(themeName, filePath) {
        for (const name of getThemeChain(themeName)) {
            const themeAssetPath = path.join(configResolver.getThemeDefinition(name).src, filePath);
            if (fs.existsSync(themeAssetPath)) {
                return themeAssetPath;
            }
        }

        return null;
    }

    function tryResolveAssetPathByModule(moduleName, filePath) {
        const moduleDefinition = configResolver.getModuleDefinition(moduleName);
        const assetPath = path.join(moduleDefinition.src, MODULE_ASSETS_PATH, filePath);
        if (fs.existsSync(assetPath)) {
            return assetPath;
        }
        return null;
    }

    const resolveAssetPath = (moduleName, filePath) => {
        if (!filePath.startsWith("assets/")) {
            return null;
        }
        let assetSrc;
        if (moduleName === "Theme") {
            assetSrc = tryResolveAssetPathByTheme(
                CURRENT_THEME,
                path.join(THEME_ASSETS_PATH, filePath),
            );
        } else {
            assetSrc = tryResolveAssetPathByTheme(
                CURRENT_THEME,
                path.join(moduleName, THEME_ASSETS_PATH, filePath),
            );
        }
        if (!assetSrc) {
            assetSrc = tryResolveAssetPathByModule(moduleName, filePath);
        }

        return assetSrc;
    };

    return {
        name: "inherit-assets-resolver",
        resolveId: {
            order: "pre",
            handler(id) {
                if (!id) {
                    return;
                }
                const idParts = id.split("::");
                if (idParts.length === 1) {
                    return;
                }
                const [moduleName, filePath] = idParts;
                const assetSrc = resolveAssetPath(moduleName, filePath);
                if (!assetSrc) {
                    return;
                }
                return assetSrc;
            },
        },
    };
}
