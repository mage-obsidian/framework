import configResolver from "./configResolver.ts";

/**
 * The theme and every ancestor it inherits from, nearest first.
 *
 * Every resolver in the engine walks `theme.parent` — components, assets, CSS
 * sources, template scan roots, theme config. They all used to recurse on their
 * own, so a contract where a theme is its own ancestor blew the stack from a
 * different place each time with no mention of the theme at fault. Walking here,
 * with a visited set, turns that into a chain that simply stops.
 *
 * Returns [] when the theme is not in the contract, and stops at the first
 * ancestor that is not either — the caller sees a shorter chain rather than an
 * entry it cannot dereference.
 */
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

/** The same chain from the root down, for callers that merge parent-first. */
export function getThemeChainFromRoot(themeName: string): string[] {
    return getThemeChain(themeName).reverse();
}

// Re-exported so callers that already deal in theme ancestry find it here; it
// lives in contractValidator because that module is pure and configResolver
// imports it, so it cannot import anything that reads the contract back.
export { findThemeCycles } from "./contractValidator.ts";

export default { getThemeChain, getThemeChainFromRoot };
