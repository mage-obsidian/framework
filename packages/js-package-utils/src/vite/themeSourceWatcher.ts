import path from "node:path";
import configResolver from "../core/configResolver.ts";
import moduleResolver from "../core/moduleResolver.ts";
import { precompileJs, precompileJsconfig, precompileTsconfig } from "../core/preCompileFiles.ts";
import { MODULE_WEB_PATH } from "../config/default.ts";

const SOURCE_EXT = /\.(vue|ts|js)$/;
// Build output and engine scratch live under the watched trees but are not
// authored sources — reacting to them would loop (we write them ourselves).
const IGNORED = /[/\\](generated|\.precompiled|node_modules)[/\\]/;
const DEBOUNCE_MS = 150;

// The source roots whose structure feeds the inheritance map: every opted-in
// module's web dir plus the theme and its parent chain. Adding/removing a
// `.vue`/`.ts`/`.js` under these changes what `Vendor_Module::` can resolve.
function collectWatchDirs(themeName) {
    const dirs = new Set();
    for (const [, definition] of configResolver.getModulesConfigArray()) {
        if (definition?.src) dirs.add(path.resolve(definition.src, MODULE_WEB_PATH));
    }
    const themes = configResolver.getMagentoConfig().themes;
    const seen = new Set();
    let name = themeName;
    while (name && themes[name] && !seen.has(name)) {
        seen.add(name);
        if (themes[name].src) dirs.add(themes[name].src);
        name = themes[name].parent;
    }
    return [...dirs];
}

/**
 * Dev-only plugin that keeps `Vendor_Module::` resolution live. Precompile runs
 * once at server start and is cached by contract hash; adding or removing a
 * component/js source changes neither, so without this the new file is invisible
 * to both the runtime resolver and the editor jsconfig until a restart. On a
 * structural change we drop the theme cache, rewrite the persisted inheritance
 * map (runtime) and regenerate the theme jsconfig (editor). Writes are
 * idempotent, so the burst of events when the watch dirs are first scanned
 * collapses to a single no-op.
 */
export default function themeSourceWatcher(themeName) {
    return {
        name: "mage-obsidian:theme-source-watcher",
        apply: "serve",
        configureServer(server) {
            for (const dir of collectWatchDirs(themeName)) {
                server.watcher.add(dir);
            }

            let timer = null;
            let running = false;
            let queued = false;

            const regenerate = async () => {
                if (running) {
                    queued = true;
                    return;
                }
                running = true;
                try {
                    moduleResolver.invalidateTheme(themeName);
                    await precompileJs(themeName);
                    await precompileJsconfig(themeName);
                    await precompileTsconfig(themeName);
                    server.config.logger.info(
                        `[mage-obsidian] sources changed — refreshed ${themeName} import resolution`,
                    );
                } catch (error) {
                    server.config.logger.error(
                        `[mage-obsidian] failed to refresh import resolution: ${error?.message ?? error}`,
                    );
                } finally {
                    running = false;
                    if (queued) {
                        queued = false;
                        schedule();
                    }
                }
            };

            const schedule = () => {
                if (timer) clearTimeout(timer);
                timer = setTimeout(regenerate, DEBOUNCE_MS);
            };

            const onChange = (file) => {
                if (!SOURCE_EXT.test(file) || IGNORED.test(file)) return;
                schedule();
            };

            server.watcher.on("add", onChange);
            server.watcher.on("unlink", onChange);
        },
    };
}
