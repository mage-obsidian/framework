import {
    EXPECTED_SCHEMA_VERSION,
    REQUIRED_CONTRACT_KEYS,
    validateContract,
} from "../../core/contractValidator.ts";

function makeValidContract(overrides = {}) {
    const base = {
        schema_version: EXPECTED_SCHEMA_VERSION,
        mode: "developer",
        modules: {},
        themes: {},
        allModules: [],
        VUE_COMPONENTS_PATH: "components",
        JS_PATH: "js",
        FOLDERS_TO_WATCH: ["components", "js"],
        ALLOWED_EXTENSIONS: ["js", "vue"],
        MODULE_CSS_EXTEND_FILE: "module.extend.css",
        MODULE_CONFIG_FILE: "module.config.js",
        THEME_CONFIG_FILE: "theme.config.js",
        THEME_CSS_SOURCE_FILE: "theme.source.css",
        THEME_FILES_PATH: "Theme",
        LIB_PATH: "lib",
    };
    return { ...base, ...overrides };
}

describe("validateContract", () => {
    it("accepts a well-formed contract", () => {
        const result = validateContract(makeValidContract());
        expect(result).toEqual({ ok: true, errors: [] });
    });

    it("rejects non-object inputs", () => {
        for (const input of [null, undefined, 42, "x", []]) {
            const result = validateContract(input);
            expect(result.ok).toBe(false);
            expect(result.errors[0]).toMatch(/not a JSON object/);
        }
    });

    it("flags a schema version mismatch with an actionable message", () => {
        const result = validateContract(makeValidContract({ schema_version: "0.9.0" }));
        expect(result.ok).toBe(false);
        expect(result.errors).toEqual(
            expect.arrayContaining([
                expect.stringContaining(`expects "${EXPECTED_SCHEMA_VERSION}"`),
            ]),
        );
    });

    it('reports a missing schema_version as "(missing)"', () => {
        const contract = makeValidContract();
        delete contract.schema_version;
        const result = validateContract(contract);
        expect(result.ok).toBe(false);
        expect(result.errors).toEqual(
            expect.arrayContaining([expect.stringContaining("(missing)")]),
        );
    });

    it("reports every missing required key", () => {
        const contract = makeValidContract();
        delete contract.modules;
        delete contract.LIB_PATH;
        const result = validateContract(contract);
        expect(result.ok).toBe(false);
        expect(result.errors).toEqual(
            expect.arrayContaining([
                'Missing required key "modules".',
                'Missing required key "LIB_PATH".',
            ]),
        );
    });

    it("honors an explicit expected version argument", () => {
        const contract = makeValidContract({ schema_version: "2.0.0" });
        expect(validateContract(contract, "2.0.0").ok).toBe(true);
    });

    it("keeps the required-key list aligned with the exported constant", () => {
        const contract = makeValidContract();
        for (const key of REQUIRED_CONTRACT_KEYS) {
            expect(Object.prototype.hasOwnProperty.call(contract, key)).toBe(true);
        }
    });
});
