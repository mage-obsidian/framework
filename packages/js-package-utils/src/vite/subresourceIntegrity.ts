// This file is part of the MageObsidian - ModernFrontend project.
//
// SPDX-FileCopyrightText: 2024 Jeanmarcos Juarez
// SPDX-License-Identifier: MIT
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const MANIFEST_PATH = path.join(".vite", "manifest.json");

type ManifestEntry = {
    file: string;
    integrity?: string;
    imports?: string[];
    dynamicImports?: string[];
};

type Manifest = Record<string, ManifestEntry>;

export function integrityOf(content: Buffer | string): string {
    return `sha384-${createHash("sha384").update(content).digest("base64")}`;
}

export function findUnhashedReachableFiles(manifest: Manifest, entryKeys: string[]): string[] {
    const missing = new Set<string>();
    const visited = new Set<string>();
    const stack = [...entryKeys];

    while (stack.length > 0) {
        const key = stack.pop();
        if (visited.has(key)) continue;
        visited.add(key);

        const entry = manifest[key];
        if (!entry) {
            missing.add(key);
            continue;
        }
        if (entry.file.endsWith(".js") && !entry.integrity) {
            missing.add(entry.file);
        }
        stack.push(...(entry.imports ?? []), ...(entry.dynamicImports ?? []));
    }

    return [...missing];
}

export default function subresourceIntegrity() {
    return {
        name: "mage-obsidian:subresource-integrity",
        apply: "build",
        writeBundle(options) {
            const outDir = options.dir;
            const manifestFile = path.join(outDir, MANIFEST_PATH);
            const manifest: Manifest = JSON.parse(readFileSync(manifestFile, "utf8"));

            for (const entry of Object.values(manifest)) {
                if (entry.file.endsWith(".js")) {
                    entry.integrity = integrityOf(readFileSync(path.join(outDir, entry.file)));
                }
            }

            const entryKeys = Object.keys(manifest);
            const unhashed = findUnhashedReachableFiles(manifest, entryKeys);
            if (unhashed.length > 0) {
                throw new Error(`Subresource integrity is missing for: ${unhashed.join(", ")}`);
            }

            writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
        },
    };
}
