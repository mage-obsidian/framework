export interface UxRuntimeConfig {
    optimistic: boolean;
    summaryCountsQty: boolean;
}

type UxRuntimeGlobal = { optimistic?: unknown; summaryCountsQty?: unknown };

interface UxRuntimeScope {
    __MAGE_OBSIDIAN_UX__?: UxRuntimeGlobal;
}

declare global {
    interface Window {
        __MAGE_OBSIDIAN_UX__?: UxRuntimeGlobal;
    }
}

const DEFAULTS: UxRuntimeConfig = { optimistic: true, summaryCountsQty: true };

export function readUxRuntimeConfig(
    scope: UxRuntimeScope | undefined = typeof window !== "undefined" ? window : undefined,
): UxRuntimeConfig {
    const config = scope && scope.__MAGE_OBSIDIAN_UX__;
    if (!config || typeof config !== "object") {
        return DEFAULTS;
    }
    return {
        optimistic: bool(config.optimistic, DEFAULTS.optimistic),
        summaryCountsQty: bool(config.summaryCountsQty, DEFAULTS.summaryCountsQty),
    };
}

function bool(value: unknown, fallback: boolean): boolean {
    return typeof value === "boolean" ? value : fallback;
}
