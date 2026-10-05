// This file is part of the MageObsidian - ModernFrontend project.
//
// SPDX-FileCopyrightText: 2024 Jeanmarcos Juarez
// SPDX-License-Identifier: MIT
export function resolveConcurrency(
    raw: string | undefined,
    themeCount: number,
    cores: number,
): number {
    const requested = Number(raw);
    const valid =
        raw !== undefined && raw.trim() !== "" && Number.isInteger(requested) && requested >= 1;
    const limit = valid ? requested : cores - 1;

    return Math.max(1, Math.min(themeCount, limit));
}
