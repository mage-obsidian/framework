import { defineConfig } from "vitest/config";

// Engine unit tests run in Node. Vitest transpiles TS/ESM natively, replacing
// the `node --experimental-vm-modules` + Jest setup. Data trees under
// __tests__ are fixtures, not suites.
export default defineConfig({
    test: {
        environment: "node",
        globals: true,
        include: ["src/__tests__/**/*.test.{js,ts}"],
        exclude: [
            "**/node_modules/**",
            "src/__tests__/magento_scenarios/**",
            "src/__tests__/fixtures/**",
            "src/__tests__/__mocks__/**",
        ],
    },
});
