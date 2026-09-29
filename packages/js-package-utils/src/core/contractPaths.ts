// This file is part of the MageObsidian - ModernFrontend project.
//
// SPDX-FileCopyrightText: 2024 Jeanmarcos Juarez
// SPDX-License-Identifier: MIT
import path from "node:path";

type Entries = Record<string, Record<string, unknown>>;

const absolutize = (entries: Entries | undefined, root: string): Entries | undefined =>
    entries && typeof entries === "object"
        ? Object.fromEntries(
              Object.entries(entries).map(([name, entry]) => [
                  name,
                  typeof entry?.src === "string"
                      ? { ...entry, src: path.resolve(root, entry.src) }
                      : entry,
              ]),
          )
        : entries;

export function withAbsoluteSources<T extends { modules?: Entries; themes?: Entries }>(
    contract: T,
    root: string,
): T {
    return {
        ...contract,
        modules: absolutize(contract.modules, root),
        themes: absolutize(contract.themes, root),
    };
}
