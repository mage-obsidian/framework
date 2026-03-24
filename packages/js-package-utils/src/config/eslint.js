import js from "@eslint/js";
import globals from "globals";
import pluginVue from "eslint-plugin-vue";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier/flat";

/**
 * Shared flat ESLint preset for the MageObsidian stack. Consumers spread the
 * default export and add their own `files`/`ignores`. Every plugin is imported
 * here (inside the mage-obsidian package), so a consuming repo only needs
 * `eslint` itself installed — the plugins resolve relative to this file.
 *
 * JS today, TypeScript after the engine migration: the TS rules are scoped to
 * `*.ts*` and the Vue `<script>` parser is already the TS parser, so `.vue`
 * files lint whether their script block is JS or TS.
 */
export default tseslint.config(
    js.configs.recommended,
    {
        files: ["**/*.{ts,mts,cts,tsx}"],
        extends: [tseslint.configs.recommended],
    },
    {
        files: ["**/*.vue"],
        extends: [pluginVue.configs["flat/recommended"]],
        languageOptions: {
            parserOptions: { parser: tseslint.parser },
        },
    },
    {
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            globals: { ...globals.node, ...globals.browser },
        },
        rules: {
            "no-unused-vars": [
                "error",
                {
                    argsIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                    caughtErrors: "none",
                },
            ],
        },
    },
    prettier,
);
