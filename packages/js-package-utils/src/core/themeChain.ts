import configResolver from "./configResolver.ts";

/** The theme and every ancestor it inherits from, nearest first. */
export function getThemeChain(themeName: string): string[] {
    const themes = configResolver.getMagentoConfig().themes ?? {};
    const chain: string[] = [];
    const seen = new Set<string>();

    let name = themeName;
    while (name && themes[name] && !seen.has(name)) {
        seen.add(name);
        chain.push(name);
        name = themes[name].parent;
    }

    return chain;
}

/** The same chain from the root down. */
export function getThemeChainFromRoot(themeName: string): string[] {
    return getThemeChain(themeName).reverse();
}

export { findThemeCycles } from "./contractValidator.ts";

export default { getThemeChain, getThemeChainFromRoot };
