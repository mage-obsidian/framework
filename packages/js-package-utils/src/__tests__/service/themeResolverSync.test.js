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
                    includeCssSourceFromParentThemes: true,
                    ignoredCssFromModules: [
                         'Vendor_ModuleNameA'
                    ],
                    exposeNpmPackages: []
                }
            },
            {
                code: 'Vendor/theme-b',
                expected: {
                    includeCssSourceFromParentThemes: true,
                    ignoredCssFromModules: [
                        'Vendor_ModuleNameA',
                        'Vendor_ModuleNameNoConfig'
                    ],
                    exposeNpmPackages: []
                }
            },
            {
                code: 'Vendor/theme-c',
                expected: {
                    includeCssSourceFromParentThemes: true,
                    ignoredCssFromModules: [
                        'Vendor_ModuleNameA',
                        'Vendor_ModuleNameNoConfig'
                    ],
                    exposeNpmPackages: []
                }
            },
            {
                code: 'Vendor/theme-d',
                expected: {
                    includeCssSourceFromParentThemes: false,
                    ignoredCssFromModules: [],
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
    }
}

async function setupThemeResolver(scenario) {
    const mock = createMockConfigResolver(scenario);

    jest.unstable_mockModule('#service/configResolver.js', () => ({
        ...mock,
        __esModule: true,
    }));

    const resolver = await import('#service/themeResolverSync.js');
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


