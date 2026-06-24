import { vi } from "vitest";
import createMockConfigResolver from "../__mocks__/configResolver.js";

let scenarios = [
    {
        scenario: "a",
        themes: [
            {
                code: "Vendor/theme-a",
                expected: {
                    includeCssSourceFromParentThemes: true,
                    ignoredCssFromModules: ["Vendor_ModuleNameA"],
                    exposeNpmPackages: [],
                    vue: { runtimeOnly: false },
                },
            },
            {
                code: "Vendor/theme-b",
                expected: {
                    includeCssSourceFromParentThemes: true,
                    ignoredCssFromModules: ["Vendor_ModuleNameA", "Vendor_ModuleNameNoConfig"],
                    exposeNpmPackages: [],
                    vue: { runtimeOnly: false },
                },
            },
            {
                code: "Vendor/theme-c",
                expected: {
                    includeCssSourceFromParentThemes: true,
                    ignoredCssFromModules: ["Vendor_ModuleNameA", "Vendor_ModuleNameNoConfig"],
                    exposeNpmPackages: [],
                    vue: { runtimeOnly: false },
                },
            },
            {
                code: "Vendor/theme-d",
                expected: {
                    includeCssSourceFromParentThemes: false,
                    ignoredCssFromModules: [],
                    exposeNpmPackages: [],
                    vue: { runtimeOnly: false },
                },
            },
        ],
    },
];

async function setupThemeResolver(scenario) {
    const mock = createMockConfigResolver(scenario);

    vi.doMock("#core/configResolver.ts", () => ({
        ...mock,
        __esModule: true,
    }));

    const resolver = await import("#core/themeResolverSync.ts");
    return resolver.default;
}

describe("getThemeConfig", () => {
    let themeResolver;

    beforeEach(() => {
        vi.resetModules();
    });

    test.each(
        scenarios.flatMap(({ scenario, themes }) =>
            themes.map(({ code, expected }) => [scenario, code, expected]),
        ),
    )('Scenario "%s", Theme "%s"', async (scenario, code, expected) => {
        themeResolver = await setupThemeResolver(scenario);

        const result = await themeResolver.getThemeConfig(code);

        expect(result).toEqual(
            expected,
            `Expected:\n${JSON.stringify(expected, null, 2)}\nReceived:\n${JSON.stringify(result, null, 2)}\nScenario: "${scenario}", Theme: "${code}"`,
        );
    });
});
