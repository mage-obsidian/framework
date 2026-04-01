import globals from "globals";
import preset from "./src/config/eslint.js";

// The build engine itself: ESM, Node runtime. Data trees under __tests__ and
// generated/template files are not linted.
export default [
    {
        ignores: [
            "node_modules/**",
            ".precompiled/**",
            "src/__tests__/magento_scenarios/**",
            "src/__tests__/fixtures/**",
            "src/__tests__/__mocks__/**",
            "src/templates/**",
        ],
    },
    ...preset,
    {
        files: ["**/*.test.{js,ts}", "src/__tests__/**"],
        languageOptions: {
            globals: { ...globals.vitest },
        },
    },
];
