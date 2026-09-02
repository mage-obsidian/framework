import configResolver from "../core/configResolver.ts";
import moduleResolver from "../core/moduleResolver.ts";
import {
    isComponentMapModule,
    mountableComponents,
    renderComponentMap,
} from "../core/islandComponentMap.ts";

export default function islandComponentsPlugin(options: { themeName?: string } = {}) {
    const { themeName } = options;

    return {
        name: "mage-obsidian:island-components",
        enforce: "pre" as const,

        async load(id: string) {
            if (!isComponentMapModule(id)) {
                return null;
            }
            const files = await moduleResolver.getAllJsVueFilesWithInheritance(themeName);
            const componentsPath = configResolver.getMagentoConfig().VUE_COMPONENTS_PATH;
            return renderComponentMap(mountableComponents(files, componentsPath));
        },
    };
}
