import path from "path";
import configResolver from "./configResolver.cjs";
import fs from "fs";

export default function customAssetsResolverPlugin() {
    const CURRENT_THEME = process.env.CURRENT_THEME;
    const THEME_ASSETS_PATH = 'web';
    const MODULE_ASSETS_PATH = 'view/frontend/web';


    function tryResolveAssetPathByTheme(themeName, filePath) {
        const themeDefinition = configResolver.getThemeDefinition(themeName);
        if (!themeDefinition) {
            return null;
        }

        const themeAssetPath = path.join(themeDefinition.src, filePath);

        if (fs.existsSync(themeAssetPath)) {
            return themeAssetPath;
        }

        if (themeDefinition.parent) {
            return tryResolveAssetPathByTheme(themeDefinition.parent, filePath);
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
        let assetSrc = null;
        if (moduleName === "Theme") {
            assetSrc = tryResolveAssetPathByTheme(CURRENT_THEME, path.join(THEME_ASSETS_PATH, filePath));
        } else {
            assetSrc = tryResolveAssetPathByTheme(CURRENT_THEME, path.join(moduleName, THEME_ASSETS_PATH, filePath));
        }
        if (!assetSrc) {
            assetSrc = tryResolveAssetPathByModule(moduleName, filePath);
        }

        return assetSrc;
    };

    return {
        name: "inherit-assets-resolver",
        resolveId: {
            order: 'pre',
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
            }
        }
    };
}
