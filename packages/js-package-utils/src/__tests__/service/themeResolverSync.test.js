import { jest } from '@jest/globals';
import createMockConfigResolver from '../__mocks__/configResolver.js';
import path from 'path';
import {fileURLToPath} from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let scenarios = [
    {
        scenario: 'a',
        themes: [
            {
                code: 'Vendor/theme-a',
                expected: {
                    tailwind: {
                        theme: { extend: {} },
                        plugins: [],
                        content: [
                            'magento_scenarios/app/design/frontend/Vendor/theme-a/web/**/*.{vue,js}',
                            'magento_scenarios/app/design/frontend/Vendor/theme-a/**/*.phtml',
                            'magento_scenarios/app/design/frontend/Vendor/theme-a/*/page_layout/override/base/*.xml'
                        ]
                    },
                    includeTailwindConfigFromParentThemes: true,
                    includeCssSourceFromParentThemes: true,
                    ignoredCssFromModules: [
                         'Vendor_ModuleNameA'
                    ],
                    ignoredTailwindConfigFromModules: [],
                    exposeNpmPackages: []
                }
            },
            {
                code: 'Vendor/theme-b',
                expected: {
                    tailwind: {
                        theme: {
                            extend: {
                                textColor: {
                                    'primary': '#3490dc',
                                    'secondary': '#ffed4a',
                                    'danger': '#e3342f',
                                },
                            }
                        },
                        plugins: [],
                        content: [
                            'magento_scenarios/app/design/frontend/Vendor/theme-a/web/**/*.{vue,js}',
                            'magento_scenarios/app/design/frontend/Vendor/theme-a/**/*.phtml',
                            'magento_scenarios/app/design/frontend/Vendor/theme-a/*/page_layout/override/base/*.xml',
                            'magento_scenarios/app/design/frontend/Vendor/theme-b/web/**/*.{vue,js}',
                            'magento_scenarios/app/design/frontend/Vendor/theme-b/**/*.phtml',
                            'magento_scenarios/app/design/frontend/Vendor/theme-b/*/page_layout/override/base/*.xml'
                        ]
                    },
                    includeTailwindConfigFromParentThemes: true,
                    includeCssSourceFromParentThemes: true,
                    ignoredCssFromModules: [
                        'Vendor_ModuleNameA',
                        'Vendor_ModuleNameNoConfig'
                    ],
                    ignoredTailwindConfigFromModules: [],
                    exposeNpmPackages: []
                }
            },
            {
                code: 'Vendor/theme-c',
                expected: {
                    tailwind: {
                        theme: { extend: {} },
                        plugins: [],
                        content: [
                            'magento_scenarios/app/design/frontend/Vendor/theme-c/web/**/*.{vue,js}',
                            'magento_scenarios/app/design/frontend/Vendor/theme-c/**/*.phtml',
                            'magento_scenarios/app/design/frontend/Vendor/theme-c/*/page_layout/override/base/*.xml'
                        ]
                    },
                    includeTailwindConfigFromParentThemes: false,
                    includeCssSourceFromParentThemes: true,
                    ignoredCssFromModules: [],
                    ignoredTailwindConfigFromModules: 'all',
                    exposeNpmPackages: []
                }
            },
            {
                code: 'Vendor/theme-d',
                expected: {
                    tailwind: {
                        theme: { extend: {} },
                        plugins: [],
                        content: []
                    },
                    includeTailwindConfigFromParentThemes: true,
                    includeCssSourceFromParentThemes: false,
                    ignoredCssFromModules: [],
                    ignoredTailwindConfigFromModules: [
                        'Vendor_ModuleNameC'
                    ],
                    exposeNpmPackages: []
                }
            }
        ]
    }
];

for (const scenario of scenarios) {
    for (const themeKey in scenario.themes) {
        let theme = scenario.themes[themeKey];
        const expected = theme.expected;
        expected.tailwind.content = expected.tailwind.content?.map((content) => path.resolve(__dirname, '..', content));
    }
}

async function setupThemeResolver(scenario) {
    jest.mock(
        '#service/configResolver.cjs',
        () => createMockConfigResolver(scenario).default
    );
    let resolver = await import('#service/themeResolverSync.cjs');
    return resolver.default;
}

describe('getThemeConfig', () => {
    let themeResolver;

    beforeEach(() => {
        jest.resetModules();
    });

    test.each(scenarios.flatMap(({ scenario, themes }) =>
        themes.map(({ code, expected }) => ([ scenario, code, expected ]))
    ))('Scenario "%s", Theme "%s"', async ( scenario, code, expected ) => {
        themeResolver = await setupThemeResolver(scenario);

        const result = await themeResolver.getThemeConfig(code);

        expect(result).toEqual(
            expected,
            `Expected:\n${JSON.stringify(expected, null, 2)}\nReceived:\n${JSON.stringify(result, null, 2)}\nScenario: "${scenario}", Theme: "${code}"`
        );
    });
});

describe('getTailwindThemeConfig', () => {
    let themeResolver;

    beforeEach(() => {
        jest.resetModules();
    });

    test.each(scenarios.flatMap(({ scenario, themes }) =>
        themes.map(({ code, expected }) => ([ scenario, code, expected ]))
    ))('Scenario "%s", Theme "%s"', async ( scenario, code, expected ) => {
        themeResolver = await setupThemeResolver(scenario);

        const result = await themeResolver.getTailwindThemeConfig(code);

        expect(result).toMatchObject(
            expected.tailwind,
            `Expected:\n${JSON.stringify(expected.tailwind, null, 2)}\nReceived:\n${JSON.stringify(result, null, 2)}\nScenario: "${scenario}", Theme: "${code}"`
        );
    });
});

