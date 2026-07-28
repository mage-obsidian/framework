import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { extractTemplate, formatForReading, renderIsland } from "../core/islandSsr.ts";

// Generates the server-side markup a template must emit so an island hydrates
// instead of shifting the page. Run by hand while writing a template, not by the
// build. Kept argv-only (no commander) to match the other internal bins.
function arg(name: string): string | undefined {
    const i = process.argv.indexOf(name);
    return i > -1 ? process.argv[i + 1] : undefined;
}

const componentFile = arg("--component");
const stateFile = arg("--state");
const propsArg = arg("--props");

if (!componentFile) {
    console.error(
        "usage: island-ssr --component <Component.vue> [--state <state.mjs|.json>] [--props <json>]\n" +
            "\n" +
            "  --state  values the template reads. A .mjs default-exporting an object can\n" +
            "           carry the methods the template calls; a .json is data only.\n" +
            "  --props  props passed to the island, as JSON.",
    );
    process.exit(1);
}

async function loadState(file: string | undefined): Promise<Record<string, unknown>> {
    if (!file) {
        return {};
    }
    const path = resolve(file);
    if (path.endsWith(".json")) {
        return JSON.parse(readFileSync(path, "utf8"));
    }
    const module = await import(pathToFileURL(path).href);
    return module.default ?? module;
}

// Vue belongs to the harness this is run from, not to the engine, so resolve it
// against the working directory instead of this file's own module tree.
async function importFromCwd(specifier: string): Promise<Record<string, never>> {
    const requireFromCwd = createRequire(pathToFileURL(resolve("package.json")).href);
    return import(pathToFileURL(requireFromCwd.resolve(specifier)).href);
}

let createSSRApp: (component: unknown, props?: Record<string, unknown>) => unknown;
let renderToString: (app: unknown) => Promise<string>;

try {
    ({ createSSRApp } = await importFromCwd("vue"));
    ({ renderToString } = await importFromCwd("vue/server-renderer"));
} catch (error) {
    console.error(
        "island-ssr needs Vue: run it from the Vite harness (component-modern-frontend/vite).\n" +
            String(error),
    );
    process.exit(1);
}

const source = readFileSync(resolve(componentFile), "utf8");
const props = propsArg ? JSON.parse(propsArg) : {};
const state = await loadState(stateFile);

const html = await renderIsland(extractTemplate(source, componentFile), state, props, {
    createSSRApp,
    renderToString,
});

console.log(formatForReading(html));
