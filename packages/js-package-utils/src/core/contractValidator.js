// Contract version this build engine understands. Must match
// ConfigInterface::SCHEMA_VERSION on the PHP side; a mismatch means the module
// and the JS engine are out of sync and the contract cannot be trusted.
export const EXPECTED_SCHEMA_VERSION = "1.0.0";

// Top-level keys the engine reads off the generated contract. Kept in step with
// the JSON schema in module-modern-frontend/src/etc.
export const REQUIRED_CONTRACT_KEYS = [
    "schema_version",
    "mode",
    "modules",
    "themes",
    "allModules",
    "VUE_COMPONENTS_PATH",
    "JS_PATH",
    "FOLDERS_TO_WATCH",
    "ALLOWED_EXTENSIONS",
    "MODULE_CSS_EXTEND_FILE",
    "MODULE_CONFIG_FILE",
    "THEME_CONFIG_FILE",
    "THEME_CSS_SOURCE_FILE",
    "THEME_FILES_PATH",
    "LIB_PATH",
];

/**
 * Validate the parsed frontend contract.
 *
 * Pure: no IO, no process exit. The caller decides how to react to errors.
 *
 * @param {unknown} config Parsed contract object.
 * @param {string} [expectedVersion] Schema version the caller expects.
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateContract(config, expectedVersion = EXPECTED_SCHEMA_VERSION) {
    if (config === null || typeof config !== "object" || Array.isArray(config)) {
        return { ok: false, errors: ["Contract is not a JSON object."] };
    }

    const errors = [];

    if (config.schema_version !== expectedVersion) {
        errors.push(
            `Schema version mismatch: this build engine expects "${expectedVersion}" ` +
                `but the contract is "${config.schema_version ?? "(missing)"}".`,
        );
    }

    for (const key of REQUIRED_CONTRACT_KEYS) {
        if (!Object.prototype.hasOwnProperty.call(config, key)) {
            errors.push(`Missing required key "${key}".`);
        }
    }

    return { ok: errors.length === 0, errors };
}
