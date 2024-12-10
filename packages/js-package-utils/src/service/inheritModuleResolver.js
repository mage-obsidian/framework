import moduleResolver from "./moduleResolver.js";
import path from "path";
import configResolver from "./configResolver.cjs";

export default function customResolverPlugin() {
    const allComponents = moduleResolver.getAllJsVueFilesWithInheritanceCached();
    const validComponentExtensions = configResolver.getMagentoConfig().ALLOWED_EXTENSIONS;

    const hasValidExtension = (filePath) =>
        validComponentExtensions.some((ext) => filePath.endsWith(ext));
    const hasExtension = (filePath) => !!path.extname(filePath);


    const resolveComponentPath = (moduleName, filePath) => {
        if (!filePath.startsWith("components/") && !filePath.startsWith("js/")) {
            filePath = "components/" + filePath;
        }
        const fileName = path.join(
            path.dirname(filePath),
            path.parse(filePath).name
        );
        return allComponents[`${moduleName}/${fileName}`];
    };

    return {
        name: "inherit-resolver",
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
                if (hasExtension(filePath) && !hasValidExtension(filePath)) {
                    return;
                }
                const componentSrc = resolveComponentPath(moduleName, filePath);
                if (!componentSrc) {
                    return;
                }

                return componentSrc;
            }
        }
    };
}
