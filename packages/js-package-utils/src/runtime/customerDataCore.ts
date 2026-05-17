/**
 * Framework customer-data core — pure helpers for mirroring Magento's private
 * content (the `customer-data` sections) into a reactive store.
 *
 * Magento owns the data: its native `customer-data.js` writes sections to
 * `localStorage['mage-cache-storage']` and (re)loads them from
 * `/customer/section/load/` (a never-cached endpoint), so this stays
 * Full-Page-Cache-safe — we only read/mirror, never write the canonical store.
 *
 * Kept free of Vue, Pinia and the DOM so the parsing/merge/staleness rules are
 * unit-testable in isolation — the Pinia store (shipped as a module web asset)
 * wraps these primitives with reactivity and the localStorage/event I/O.
 */

/**
 * Parse the raw `mage-cache-storage` JSON into a map of section objects.
 * Tolerates missing/corrupt input and drops non-object section values so the
 * caller always gets a clean `{ [section]: object }` map.
 *
 * @param {string | null | undefined} raw
 * @returns {Record<string, Record<string, unknown>>}
 */
export function parseSectionStorage(raw) {
    if (typeof raw !== "string" || raw === "") {
        return {};
    }

    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return {};
    }

    return pickObjectEntries(parsed);
}

/**
 * Return a single section, or null when it is absent or not an object.
 *
 * @param {Record<string, unknown> | null | undefined} sections
 * @param {string} name
 * @returns {Record<string, unknown> | null}
 */
export function selectSection(sections, name) {
    if (!sections || typeof sections !== "object") {
        return null;
    }
    const value = sections[name];
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

/**
 * Overlay freshly loaded sections onto the current map (a `/section/load`
 * response merges per section; non-object values are ignored).
 *
 * @param {Record<string, unknown> | null | undefined} current
 * @param {Record<string, unknown> | null | undefined} incoming
 * @returns {Record<string, Record<string, unknown>>}
 */
export function mergeSections(current, incoming) {
    return { ...pickObjectEntries(current), ...pickObjectEntries(incoming) };
}

/**
 * Whether a section should be (re)fetched. A missing section is stale; a
 * section without a positive `data_id` is a client-side section that never
 * expires; with no positive lifetime nothing expires either. Otherwise it is
 * stale once `data_id + lifetime` has passed.
 *
 * @param {Record<string, unknown> | null | undefined} section
 * @param {number} lifetimeSeconds
 * @param {number} nowSeconds
 * @returns {boolean}
 */
export function isSectionStale(section, lifetimeSeconds, nowSeconds) {
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
 * Build the `/customer/section/load/` URL Magento uses to (re)load sections.
 * An empty list requests ALL sections by omitting the `sections` param —
 * Magento returns every section then and rejects a literal `sections=*` with 400.
 *
 * @param {Array<string>} sectionNames
 * @param {{ baseUrl?: string, forceNewTimestamp?: boolean }} [options]
 * @returns {string}
 */
export function buildSectionLoadUrl(sectionNames, options = {}) {
    const { baseUrl = "/", forceNewTimestamp = false } = options;
    const names = Array.isArray(sectionNames) ? sectionNames.filter(Boolean) : [];
    const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;

    const params = [];
    if (names.length) {
        params.push(`sections=${names.join(",")}`);
    }
    params.push(`force_new_section_timestamp=${forceNewTimestamp ? "true" : "false"}`);

    return `${base}customer/section/load/?${params.join("&")}`;
}

/**
 * Read a single cookie value from a `document.cookie` string. Returns "" when
 * the cookie is absent. Kept pure (the store passes `document.cookie` in) so the
 * private-content-version lookup is testable without a DOM.
 *
 * @param {string | null | undefined} cookieString
 * @param {string} name
 * @returns {string}
 */
export function readCookie(cookieString, name) {
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
 * Magento bumps the `private_content_version` cookie whenever a session's
 * private content changes. This stack does not run Magento's native
 * customer-data (which would own `localStorage['mage-cache-storage']`), so the
 * bridge hydrates itself: when nothing is cached yet, or the version cookie has
 * moved past the last synced version, the cached sections are stale.
 *
 * @param {Record<string, unknown> | null | undefined} sections
 * @param {string} syncedVersion last version we fully synced for
 * @param {string} currentVersion the private_content_version cookie value
 * @returns {boolean}
 */
export function needsHydration(sections, syncedVersion, currentVersion) {
    if (!sections || typeof sections !== "object" || Object.keys(sections).length === 0) {
        return true;
    }
    return currentVersion !== "" && currentVersion !== syncedVersion;
}

/**
 * @param {unknown} value
 * @returns {Record<string, Record<string, unknown>>}
 */
function pickObjectEntries(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return {};
    }

    const result = {};
    for (const [key, entry] of Object.entries(value)) {
        if (entry && typeof entry === "object" && !Array.isArray(entry)) {
            result[key] = entry;
        }
    }
    return result;
}
