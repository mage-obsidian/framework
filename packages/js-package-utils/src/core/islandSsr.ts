/**
 * Renders an island component's initial state to the HTML a template has to emit
 * for `renderVueComponent`'s `$serverHtml` argument.
 *
 * Vue's hydration expects fragment anchors (`<!--[-->`, `<!---->`) that nobody
 * can reasonably write by hand, so the markup is generated from the component's
 * own `<template>` instead of transcribed. Only the template is used: the SFC's
 * `<script setup>` is never executed, so this needs no bundler, no alias
 * resolution and no browser — the caller supplies the state the template reads,
 * which is the same state the server will have.
 *
 * Development tooling only. Nothing here ships to a storefront.
 */

export interface SsrDeps {
    createSSRApp(component: unknown, props?: Record<string, unknown>): unknown;
    renderToString(app: unknown): Promise<string>;
}

/**
 * Pull the `<template>` block out of a single-file component.
 *
 * @throws Error When the file has no template block.
 */
export function extractTemplate(source: string, file = "component"): string {
    const opening = source.match(/<template(\s[^>]*)?>/);
    if (!opening || opening.index === undefined) {
        throw new Error(`${file} has no <template> block, so there is no markup to render.`);
    }

    const start = opening.index + opening[0].length;
    const end = source.lastIndexOf("</template>");
    if (end < start) {
        throw new Error(`${file} has an unterminated <template> block.`);
    }

    return source.slice(start, end).trim();
}

/**
 * Render a component's template against a state object.
 *
 * `state` becomes the component's setup bindings, so it can carry the methods a
 * template calls (`isAvailable()`, `swatchOf()`, …) and not just plain data. A
 * `components` key is lifted out and registered instead: a template compiled at
 * runtime resolves child components through the options entry, not through setup
 * bindings the way a compiled `<script setup>` does.
 */
export async function renderIsland(
    template: string,
    state: Record<string, unknown>,
    props: Record<string, unknown>,
    deps: SsrDeps,
): Promise<string> {
    const { components = {}, ...bindings } = state;
    const component = {
        props: Object.keys(props),
        components: components as Record<string, unknown>,
        setup: () => bindings,
        template,
    };

    return deps.renderToString(deps.createSSRApp(component, props));
}

/**
 * Break a rendered island into one line per element, for a readable diff against
 * a template. Purely cosmetic — the value handed to `$serverHtml` is the
 * unformatted string, and PHP condenses whitespace anyway.
 */
export function formatForReading(html: string): string {
    return html.replace(/></g, ">\n<");
}
