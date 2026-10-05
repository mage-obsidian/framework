// This file is part of the MageObsidian - ModernFrontend project.
//
// SPDX-FileCopyrightText: 2024 Jeanmarcos Juarez
// SPDX-License-Identifier: MIT
export default {
    name: "default-node-resolver",
    resolveId: {
        order: "post",
        handler(id) {
            try {
                const resolvedPath = import.meta.resolve(id);
                if (resolvedPath) {
                    return resolvedPath.replace("file://", "");
                }
            } catch {
                // Not resolvable as a node package; let later resolvers handle it.
            }
            return null;
        },
    },
};
