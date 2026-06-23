import { cp, mkdir, readdir } from "node:fs/promises";
import path from "node:path";

// tsc only emits the .ts tree. Non-TS runtime assets (templates read via fs,
// the exposed eslint config) must be mirrored into dist verbatim so the
// published package resolves them at the same relative paths it used in src.
const SRC = path.resolve("src");
const DIST = path.resolve("dist");
const SKIP_DIRS = new Set(["__tests__", "__mocks__"]);

async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (SKIP_DIRS.has(entry.name)) continue;
            await walk(full);
            continue;
        }
        if (entry.name.endsWith(".ts")) continue;
        const rel = path.relative(SRC, full);
        const target = path.join(DIST, rel);
        await mkdir(path.dirname(target), { recursive: true });
        await cp(full, target);
    }
}

await walk(SRC);
