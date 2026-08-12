import moduleResolver from "../core/moduleResolver.ts";
import path from "path";
import configResolver from "../core/configResolver.ts";

export default function customResolverPlugin() {
    const validComponentExtensions = configResolver.getMagentoConfig().ALLOWED_EXTENSIONS;

    const hasValidExtension = (filePath) =>
        validComponentExtensions.some((ext) => filePath.endsWith(ext));
    const hasExtension = (filePath) => !!path.extname(filePath);

    // Asked for per resolution, not captured once: the getter re-reads the
    // precompiled map whenever it changes on disk and hands back a new object,
    // so a plugin instance that holds the first one keeps resolving against a
    // map frozen at boot. The dev server lives far longer than that.
    const resolveComponentPath = (moduleName, filePath) => {
        if (!filePath.startsWith("components/") && !filePath.startsWith("js/")) {
            filePath = "components/" + filePath;
        }
        const fileName = path.join(path.dirname(filePath), path.parse(filePath).name);
        return moduleResolver.getAllJsVueFilesWithInheritanceCached()[`${moduleName}/${fileName}`];
    };

    return {
        name: "inherit-resolver",
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
                if (hasExtension(filePath) && !hasValidExtension(filePath)) {
                    return;
                }
                const componentSrc = resolveComponentPath(moduleName, filePath);
                if (!componentSrc) {
                    return;
                }

                return componentSrc;
            },
        },
    };
}
