// This file is part of the MageObsidian - ModernFrontend project.
//
// SPDX-FileCopyrightText: 2024 Jeanmarcos Juarez
// SPDX-License-Identifier: MIT
export const DEV_SERVER_REQUIRED_ENV = ["VITE_SERVER_HOST", "VITE_SERVER_PORT"] as const;

export function missingEnvFor(
    devServer: boolean,
    env: Record<string, string | undefined>,
): string[] {
    if (!devServer) {
        return [];
    }
    return DEV_SERVER_REQUIRED_ENV.filter((name) => !env[name]);
}
