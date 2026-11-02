// This file is part of the MageObsidian - ModernFrontend project.
//
// SPDX-FileCopyrightText: 2026 Jeanmarcos Juarez
// SPDX-License-Identifier: MIT
const ATTRIBUTE = "data-mage-obsidian-config";

export const PageConfig = {
    I18n: "i18n",
    Icons: "icons",
    PrePaint: "prepaint",
    SectionPrefetch: "section-prefetch-config",
    Sections: "sections",
    Ux: "ux",
} as const;

export type PageConfig = (typeof PageConfig)[keyof typeof PageConfig];

interface ConfigElement {
    textContent: string | null;
    getAttribute?(name: string): string | null;
}

interface ConfigDocument {
    querySelector(selector: string): ConfigElement | null;
    querySelectorAll(selector: string): ArrayLike<ConfigElement>;
}

const readByScope = new WeakMap<object, Map<string, unknown>>();

export function globalKeyFor(name: string): string {
    return `__MAGE_OBSIDIAN_${name.toUpperCase().replace(/-/g, "_")}__`;
}

function documentOf(scope: object): ConfigDocument | undefined {
    return (scope as { document?: ConfigDocument }).document;
}

function parse(text: string | null | undefined): unknown {
    if (!text) {
        return undefined;
    }
    try {
        return JSON.parse(text);
    } catch {
        return undefined;
    }
}

function readOnce(scope: object): Map<string, unknown> {
    let read = readByScope.get(scope);
    if (!read) {
        read = new Map();
        readByScope.set(scope, read);
    }
    return read;
}

export function readPageConfig(
    name: string,
    scope: object | undefined = typeof window !== "undefined" ? window : undefined,
): unknown {
    if (!scope) {
        return undefined;
    }
    const read = readOnce(scope);
    if (read.has(name)) {
        return read.get(name);
    }
    const globals = scope as Record<string, unknown>;
    const element = documentOf(scope)?.querySelector(
        `script[type="application/json"][${ATTRIBUTE}="${name}"]`,
    );
    const value = parse(element?.textContent);
    if (value === undefined) {
        return globals[globalKeyFor(name)];
    }
    read.set(name, value);
    globals[globalKeyFor(name)] = value;
    return value;
}

export function publishPageConfigs(
    scope: object | undefined = typeof window !== "undefined" ? window : undefined,
): string[] {
    const elements = scope
        ? documentOf(scope)?.querySelectorAll(`script[type="application/json"][${ATTRIBUTE}]`)
        : undefined;
    if (!scope || !elements) {
        return [];
    }
    const published: string[] = [];
    for (const element of Array.from(elements)) {
        const name = element.getAttribute?.(ATTRIBUTE);
        if (
            name &&
            parse(element.textContent) !== undefined &&
            readPageConfig(name, scope) !== undefined
        ) {
            published.push(name);
        }
    }
    return published;
}
