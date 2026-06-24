export interface VueAliasOptions {
    runtimeOnly?: boolean;
    production?: boolean;
}

// runtime-only drops Vue's template compiler (~61 KiB), which the island
// bootstrap never uses — every component is a precompiled SFC. Themes relying
// on the in-DOM template escape hatch must keep the full build, so this stays
// opt-in per theme.
export function resolveVueAlias(
    { runtimeOnly = false, production = false }: VueAliasOptions = {},
): string {
    const build = runtimeOnly ? "vue.runtime.esm-browser" : "vue.esm-browser";
    const ext = production ? ".prod.js" : ".js";
    return `vue/dist/${build}${ext}`;
}

export default resolveVueAlias;
