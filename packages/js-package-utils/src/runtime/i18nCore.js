/**
 * Framework i18n core — Magento-parity phrase translation for the Vue/ESM side.
 *
 * Mirrors Magento's `$t` / `$.mage.__`: a phrase is looked up in the dictionary
 * (the per-locale `js-translation.json` Magento already generates during static
 * deploy) and falls back to the original phrase when absent; then `%1`, `%2`, …
 * placeholders are substituted positionally.
 *
 * Kept free of Vue and the DOM so it is unit-testable in isolation — the Vue
 * plugin (shipped as a module web asset) wraps these primitives.
 */

const PLACEHOLDER = /%(\d+)/g;

/**
 * Replace `%1`, `%2`, … with positional args. An out-of-range placeholder is
 * left untouched so a malformed phrase never throws or yields "undefined".
 *
 * @param {string} text
 * @param {Array<unknown>} [args]
 * @returns {string}
 */
export function interpolate(text, args = []) {
    if (typeof text !== "string" || !args || args.length === 0) {
        return text;
    }
    return text.replace(PLACEHOLDER, (match, index) => {
        const value = args[Number(index) - 1];
        return value === undefined ? match : String(value);
    });
}

/**
 * Translate a phrase against a dictionary, falling back to the phrase itself,
 * then interpolate placeholders.
 *
 * @param {Record<string, string> | null | undefined} dictionary
 * @param {string} phrase
 * @param {Array<unknown>} [args]
 * @returns {string}
 */
export function translatePhrase(dictionary, phrase, args = []) {
    const dict = dictionary && typeof dictionary === "object" ? dictionary : {};
    const translated = Object.prototype.hasOwnProperty.call(dict, phrase) ? dict[phrase] : phrase;
    return interpolate(translated, args);
}

/**
 * Read the runtime i18n config published by PHP as `window.__MAGE_OBSIDIAN_I18N__`.
 * Returns sane defaults when absent so the layer degrades to passthrough.
 *
 * @param {{ __MAGE_OBSIDIAN_I18N__?: { locale?: string, dictionaryUrl?: string } }} [scope]
 * @returns {{ locale: string, dictionaryUrl: string | null }}
 */
export function readI18nConfig(scope = typeof window !== "undefined" ? window : undefined) {
    const config = scope && scope.__MAGE_OBSIDIAN_I18N__;
    return {
        locale: (config && config.locale) || "en_US",
        dictionaryUrl: (config && config.dictionaryUrl) || null,
    };
}

const dictionaryCache = new Map();

/**
 * Fetch and cache a dictionary by URL. The fetch happens at most once per URL
 * regardless of how many Vue apps request it. Magento emits `[]` for an empty
 * dictionary, which is normalized to `{}`; any failure degrades to `{}` so the
 * UI keeps rendering original phrases.
 *
 * @param {string | null | undefined} url
 * @param {typeof fetch} [fetchImpl]
 * @returns {Promise<Record<string, string>>}
 */
export function loadDictionary(url, fetchImpl = typeof fetch !== "undefined" ? fetch : undefined) {
    if (!url) {
        return Promise.resolve({});
    }
    if (!dictionaryCache.has(url)) {
        if (typeof fetchImpl !== "function") {
            return Promise.resolve({});
        }
        const promise = fetchImpl(url)
            .then((res) => (res && res.ok ? res.json() : {}))
            .then((data) => (data && typeof data === "object" && !Array.isArray(data) ? data : {}))
            .catch(() => ({}));
        dictionaryCache.set(url, promise);
    }
    return dictionaryCache.get(url);
}

/**
 * Test-only: clear the dictionary cache between cases.
 */
export function _resetDictionaryCache() {
    dictionaryCache.clear();
}
