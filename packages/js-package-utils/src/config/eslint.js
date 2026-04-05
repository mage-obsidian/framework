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
const unusedVarsOptions = {
    argsIgnorePattern: "^_",
    varsIgnorePattern: "^_",
    caughtErrors: "none",
};

export default tseslint.config(
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            globals: { ...globals.node, ...globals.browser },
        },
    },
    {
        // Plain JS (author code, engine bits not yet migrated): the base rule.
        files: ["**/*.{js,mjs,cjs}"],
        rules: {
            "no-unused-vars": ["error", unusedVarsOptions],
        },
    },
    {
        files: ["**/*.{ts,mts,cts,tsx}"],
        extends: [tseslint.configs.recommended],
        rules: {
            // tseslint disables the base rule for TS; use the TS-aware one so
            // labels in function-type annotations aren't flagged as unused.
            "@typescript-eslint/no-unused-vars": ["error", unusedVarsOptions],
            // Lenient migration baseline: the engine is typed progressively, so
            // explicit `any` is allowed but surfaced as a warning (ratchet
            // target, alongside tsconfig `strict`).
            "@typescript-eslint/no-explicit-any": "warn",
        },
    },
    {
        files: ["**/*.vue"],
        extends: [pluginVue.configs["flat/recommended"]],
        languageOptions: {
            parserOptions: { parser: tseslint.parser },
        },
    },
    prettier,
);
