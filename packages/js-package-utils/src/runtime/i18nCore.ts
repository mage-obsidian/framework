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

export interface I18nConfig {
    locale?: string;
    dictionaryUrl?: string;
}

interface I18nScope {
    __MAGE_OBSIDIAN_I18N__?: I18nConfig;
}

export type Dictionary = Record<string, string>;

// Published by PHP on the page before the ESM runtime loads.
declare global {
    interface Window {
        __MAGE_OBSIDIAN_I18N__?: I18nConfig;
    }
}

const PLACEHOLDER = /%(\d+)/g;

/**
 * Replace `%1`, `%2`, … with positional args. An out-of-range placeholder is
 * left untouched so a malformed phrase never throws or yields "undefined".
 */
export function interpolate(text: string, args: unknown[] = []): string {
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
 */
export function translatePhrase(
    dictionary: Dictionary | null | undefined,
    phrase: string,
    args: unknown[] = [],
): string {
    const dict = dictionary && typeof dictionary === "object" ? dictionary : {};
    const translated = Object.prototype.hasOwnProperty.call(dict, phrase) ? dict[phrase] : phrase;
    return interpolate(translated, args);
}

/**
 * Read the runtime i18n config published by PHP as `window.__MAGE_OBSIDIAN_I18N__`.
 * Returns sane defaults when absent so the layer degrades to passthrough.
 */
export function readI18nConfig(
    scope: I18nScope | undefined = typeof window !== "undefined" ? window : undefined,
): { locale: string; dictionaryUrl: string | null } {
    const config = scope && scope.__MAGE_OBSIDIAN_I18N__;
    return {
        locale: (config && config.locale) || "en_US",
        dictionaryUrl: (config && config.dictionaryUrl) || null,
    };
}

const dictionaryCache = new Map<string, Promise<Dictionary>>();

/**
 * Fetch and cache a dictionary by URL. The fetch happens at most once per URL
 * regardless of how many Vue apps request it. Magento emits `[]` for an empty
 * dictionary, which is normalized to `{}`; any failure degrades to `{}` so the
 * UI keeps rendering original phrases.
 */
export function loadDictionary(
    url: string | null | undefined,
    fetchImpl: typeof fetch | undefined = typeof fetch !== "undefined" ? fetch : undefined,
): Promise<Dictionary> {
    if (!url) {
        return Promise.resolve({});
    }
    if (!dictionaryCache.has(url)) {
        if (typeof fetchImpl !== "function") {
            return Promise.resolve({});
        }
        const promise: Promise<Dictionary> = fetchImpl(url)
            .then((res) => (res && res.ok ? res.json() : {}))
            .then((data: unknown): Dictionary =>
                data && typeof data === "object" && !Array.isArray(data)
                    ? (data as Dictionary)
                    : {},
            )
            .catch((): Dictionary => ({}));
        dictionaryCache.set(url, promise);
    }
    return dictionaryCache.get(url)!;
}

/**
 * Test-only: clear the dictionary cache between cases.
 */
export function _resetDictionaryCache(): void {
    dictionaryCache.clear();
}

let facadeDictionary: Dictionary = {};
let facadeLoadStarted = false;

function ensureFacadeDictionary(): void {
    if (facadeLoadStarted) {
        return;
    }
    facadeLoadStarted = true;
    const { dictionaryUrl } = readI18nConfig();
    loadDictionary(dictionaryUrl).then((loaded) => {
        facadeDictionary = loaded;
    });
}

/**
 * i18n facade for plain (non-Vue) ESM enhancers. Translation is exposed as a
 * `$t` METHOD on purpose: minifiers preserve property names, so the compiled
 * bundle keeps the literal `$t("…")` call that Magento's native JS translation
 * scanner discovers (`Magento\Translation\Model\Js\Config`). A bare imported
 * function would be renamed to a single letter and the phrase would never reach
 * `js-translation.json`. The dictionary loads once (shared cache with the Vue
 * runtime) and translation degrades to the original phrase until it resolves.
 */
export const i18n = {
    $t(phrase: string, ...args: unknown[]): string {
        ensureFacadeDictionary();
        return translatePhrase(facadeDictionary, phrase, args);
    },
};

/**
 * Test-only: reset the facade dictionary state between cases.
 */
export function _resetI18nFacade(): void {
    facadeDictionary = {};
    facadeLoadStarted = false;
}
