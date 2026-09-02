const MODULE_TAIL = /[\\/]runtime[\\/]islandComponents\.(ts|js)$/;

export function isComponentMapModule(id: string): boolean {
    return MODULE_TAIL.test(id.split("?")[0]);
}

export function mountableComponents(
    files: Record<string, string>,
    componentsPath = "components",
): Record<string, string> {
    const segment = `/${componentsPath}/`;
    const mountable: Record<string, string> = {};
    for (const key of Object.keys(files).sort()) {
        if (key.includes(segment) && files[key]) {
            mountable[key] = files[key];
        }
    }
    return mountable;
}

export function renderComponentMap(mountable: Record<string, string>): string {
    const entries = Object.entries(mountable).map(
        ([name, file]) => `    ${JSON.stringify(name)}: () => import(${JSON.stringify(file)}),`,
    );
    return `const components = {\n${entries.join("\n")}\n};\nexport default components;\n`;
}
