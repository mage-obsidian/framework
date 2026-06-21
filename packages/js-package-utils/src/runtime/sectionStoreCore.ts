/**
 * Section store core — pure helpers for mirroring a set of server-pushed,
 * versioned "sections" into a reactive store backed by localStorage.
 *
 * This is the GENERIC mechanism, deliberately domain-agnostic: it knows how to
 * parse/merge/select sections, decide staleness, read a version cookie and
 * decide when to hydrate — but nothing about WHICH endpoint, cookie or storage
 * key a given integration uses. A binding (e.g. the Magento customer-data
 * adapter) supplies those and wraps these primitives with Vue/Pinia reactivity.
 *
 * Kept free of Vue, Pinia and the DOM so the parsing/merge/staleness rules are
 * unit-testable in isolation.
 */

export type SectionData = Record<string, unknown>;
export type SectionMap = Record<string, SectionData>;

export interface SectionLoadOptions {
    baseUrl?: string;
    forceNewTimestamp?: boolean;
}

export interface SectionRuntimeConfig {
    lifetimeSeconds: number;
    expirableSections: string[];
}

interface SectionRuntimeScope {
    __MAGE_OBSIDIAN_SECTIONS__?: { lifetime?: unknown; expirable?: unknown };
}

// Published by PHP on the page before the ESM runtime loads.
declare global {
    interface Window {
        __MAGE_OBSIDIAN_SECTIONS__?: { lifetime?: unknown; expirable?: unknown };
    }
}

/**
 * Parse the raw section-storage JSON into a map of section objects. Tolerates
 * missing/corrupt input and drops non-object section values so the caller
 * always gets a clean `{ [section]: object }` map.
 */
export function parseSectionStorage(raw: string | null | undefined): SectionMap {
    if (typeof raw !== "string" || raw === "") {
        return {};
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return {};
    }

    return pickObjectEntries(parsed);
}

/**
 * Return a single section, or null when it is absent or not an object.
 */
export function selectSection(sections: SectionMap | null | undefined, name: string): SectionData | null {
    if (!sections || typeof sections !== "object") {
        return null;
    }
    const value = sections[name];
    return value && typeof value === "object" && !Array.isArray(value) ? (value as SectionData) : null;
}

/**
 * Overlay freshly loaded sections onto the current map (a section-load response
 * merges per section; non-object values are ignored).
 */
export function mergeSections(
    current: SectionMap | null | undefined,
    incoming: SectionMap | null | undefined,
): SectionMap {
    return { ...pickObjectEntries(current), ...pickObjectEntries(incoming) };
}

/**
 * Whether a section should be (re)fetched. A missing section is stale; a
 * section without a positive `data_id` is a client-side section that never
 * expires; with no positive lifetime nothing expires either. Otherwise it is
 * stale once `data_id + lifetime` has passed.
 */
export function isSectionStale(
    section: SectionData | null | undefined,
    lifetimeSeconds: number,
    nowSeconds: number,
): boolean {
    if (!section || typeof section !== "object") {
        return true;
    }

    const dataId = Number(section.data_id);
    if (!Number.isFinite(dataId) || dataId <= 0) {
        return false;
    }
    if (!Number.isFinite(lifetimeSeconds) || lifetimeSeconds <= 0) {
        return false;
    }

    return dataId + lifetimeSeconds <= nowSeconds;
}

/**
 * Build the section-load URL a binding uses to (re)load sections. `endpoint` is
 * supplied by the binding (this core is endpoint-agnostic). An empty name list
 * requests ALL sections by omitting the `sections` param — Magento's protocol
 * returns every section then and rejects a literal `sections=*` with 400.
 */
export function buildSectionLoadUrl(
    endpoint: string,
    sectionNames: string[],
    options: SectionLoadOptions = {},
): string {
    const { baseUrl = "/", forceNewTimestamp = false } = options;
    const names = Array.isArray(sectionNames) ? sectionNames.filter(Boolean) : [];
    const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
    const path = endpoint.startsWith("/") ? endpoint.slice(1) : endpoint;

    const params: string[] = [];
    if (names.length) {
        params.push(`sections=${names.join(",")}`);
    }
    params.push(`force_new_section_timestamp=${forceNewTimestamp ? "true" : "false"}`);

    return `${base}${path}?${params.join("&")}`;
}

/**
 * Read a single cookie value from a `document.cookie` string. Returns "" when
 * the cookie is absent. Kept pure (the binding passes `document.cookie` in) so
 * the version lookup is testable without a DOM.
 */
export function readCookie(cookieString: string | null | undefined, name: string): string {
    if (typeof cookieString !== "string" || cookieString === "" || !name) {
        return "";
    }
    for (const pair of cookieString.split(";")) {
        const index = pair.indexOf("=");
        if (index === -1) {
            continue;
        }
        if (pair.slice(0, index).trim() === name) {
            return decodeURIComponent(pair.slice(index + 1).trim());
        }
    }
    return "";
}

/**
 * Whether the store must hydrate sections from the server on init.
 *
 * A binding bumps a version (e.g. Magento's `private_content_version` cookie)
 * whenever the server's pushed content changes. When nothing is cached yet, or
 * the current version has moved past the last synced version, the cached
 * sections are stale.
 */
export function needsHydration(
    sections: SectionMap | null | undefined,
    syncedVersion: string,
    currentVersion: string,
): boolean {
    if (!sections || typeof sections !== "object" || Object.keys(sections).length === 0) {
        return true;
    }
    return currentVersion !== "" && currentVersion !== syncedVersion;
}

/**
 * True when the session marker cookie is gone. Magento's login/logout controllers
 * delete it server-side, so its absence means cached sections are stale (the
 * version cookie doesn't move on logout). False when no marker is configured.
 */
export function sessionInvalidated(
    cookieString: string | null | undefined,
    sessionCookieName: string,
): boolean {
    if (!sessionCookieName) {
        return false;
    }
    return readCookie(cookieString, sessionCookieName) === "";
}

/**
 * The expirable sections that have aged out and must be re-fetched, mirroring the
 * lifetime branch of Magento's native `getExpiredSectionNames`: a section listed
 * in `expirableNames` expires once `data_id + lifetimeSeconds <= now`.
 *
 * This is the backstop the version cookie cannot provide: `private_content_version`
 * only moves on POST, so a section whose server data changed through a non-POST
 * path the browser took — most commonly the PHP session/quote expiring while
 * localStorage lives on — is otherwise never re-fetched, leaving a stale snapshot
 * (e.g. a cart badge that outlives its quote). Absent sections are skipped here,
 * exactly like native (they reload via the version/empty-cache path instead).
 */
export function expiredSectionNames(
    sections: SectionMap | null | undefined,
    lifetimeSeconds: number,
    expirableNames: string[],
    nowSeconds: number,
): string[] {
    if (!Array.isArray(expirableNames) || expirableNames.length === 0) {
        return [];
    }
    const map = sections && typeof sections === "object" ? sections : {};
    const expired: string[] = [];
    for (const name of expirableNames) {
        const section = map[name];
        if (section && typeof section === "object" && isSectionStale(section, lifetimeSeconds, nowSeconds)) {
            expired.push(name);
        }
    }
    return expired;
}

/**
 * Read the runtime section config a binding's host page publishes (lifetime +
 * which sections expire by lifetime). Kept pure — the binding passes the scope
 * (e.g. `window`) — so it is testable without a DOM, like `readI18nConfig`.
 */
export function readSectionRuntimeConfig(
    scope: SectionRuntimeScope | undefined = typeof window !== "undefined" ? window : undefined,
): SectionRuntimeConfig {
    const config = scope && scope.__MAGE_OBSIDIAN_SECTIONS__;
    const lifetime = Number(config && config.lifetime);
    const expirable = config && config.expirable;
    return {
        lifetimeSeconds: Number.isFinite(lifetime) && lifetime > 0 ? lifetime : 0,
        expirableSections: Array.isArray(expirable)
            ? expirable.filter((name): name is string => typeof name === "string")
            : [],
    };
}

function pickObjectEntries(value: unknown): SectionMap {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return {};
    }

    const result: SectionMap = {};
    for (const [key, entry] of Object.entries(value)) {
        if (entry && typeof entry === "object" && !Array.isArray(entry)) {
            result[key] = entry as SectionData;
        }
    }
    return result;
}
