// This file is part of the MageObsidian - ModernFrontend project.
//
// SPDX-FileCopyrightText: 2024 Jeanmarcos Juarez
// SPDX-License-Identifier: MIT
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { build } from "vite";
import subresourceIntegrity, {
    findUnhashedReachableFiles,
    integrityOf,
} from "#vite/subresourceIntegrity.ts";

const sha384 = (buffer) => `sha384-${createHash("sha384").update(buffer).digest("base64")}`;

describe("subresource-integrity", () => {
    let root;
    let outDir;

    beforeEach(() => {
        root = mkdtempSync(path.join(tmpdir(), "sri-"));
        outDir = path.join(root, "out");
        mkdirSync(path.join(root, "src"));
        writeFileSync(
            path.join(root, "src", "shared.js"),
            "export const shared = () => 'shared-' + Date.now();\n",
        );
        writeFileSync(
            path.join(root, "src", "lazy.js"),
            "import { shared } from './shared.js';\nexport default () => 'lazy' + shared();\n",
        );
        writeFileSync(
            path.join(root, "src", "entry.js"),
            "import { shared } from './shared.js';\nwindow.load = () => import('./lazy.js');\nconsole.log(shared());\n",
        );
        writeFileSync(
            path.join(root, "src", "other.js"),
            "import { shared } from './shared.js';\nconsole.log('other', shared());\n",
        );
    });

    afterEach(() => {
        rmSync(root, { recursive: true, force: true });
    });

    const compile = async () => {
        await build({
            root,
            configFile: false,
            logLevel: "silent",
            plugins: [subresourceIntegrity()],
            build: {
                outDir,
                emptyOutDir: true,
                manifest: true,
                rollupOptions: {
                    input: {
                        entry: path.join(root, "src", "entry.js"),
                        other: path.join(root, "src", "other.js"),
                    },
                },
            },
        });
        return JSON.parse(readFileSync(path.join(outDir, ".vite", "manifest.json"), "utf8"));
    };

    it("writes the sha384 of every emitted chunk into the manifest", async () => {
        const manifest = await compile();
        const scripts = Object.values(manifest).filter((entry) => entry.file.endsWith(".js"));

        expect(scripts.length).toBeGreaterThanOrEqual(4);
        for (const entry of scripts) {
            expect(entry.integrity).toBe(sha384(readFileSync(path.join(outDir, entry.file))));
        }
    });

    it("leaves no chunk reachable from an entry without a hash, dynamic imports included", async () => {
        const manifest = await compile();
        const entryKeys = Object.keys(manifest).filter((key) => manifest[key].isEntry);

        expect(entryKeys.length).toBe(2);
        expect(findUnhashedReachableFiles(manifest, entryKeys)).toEqual([]);

        const lazy = Object.values(manifest).find((entry) => entry.src === "src/lazy.js");
        expect(lazy.integrity).toBe(sha384(readFileSync(path.join(outDir, lazy.file))));
    });

    it("names a reachable chunk that carries no hash", () => {
        const manifest = {
            "src/entry.js": {
                file: "entry.js",
                isEntry: true,
                integrity: "sha384-a",
                imports: ["_shared.js"],
                dynamicImports: ["src/lazy.js"],
            },
            "_shared.js": { file: "shared-1.js", integrity: "sha384-b" },
            "src/lazy.js": { file: "lazy-1.js" },
        };

        expect(findUnhashedReachableFiles(manifest, ["src/entry.js"])).toEqual(["lazy-1.js"]);
    });

    it("names a reachable chunk the manifest does not describe", () => {
        const manifest = {
            "src/entry.js": {
                file: "entry.js",
                isEntry: true,
                integrity: "sha384-a",
                imports: ["_missing.js"],
            },
        };

        expect(findUnhashedReachableFiles(manifest, ["src/entry.js"])).toEqual(["_missing.js"]);
    });

    it("hashes a buffer the way a browser verifies it", () => {
        const buffer = Buffer.from("export default 1;\n");

        expect(integrityOf(buffer)).toBe(sha384(buffer));
    });
});
