import { jest } from '@jest/globals';
import createMockConfigResolver from '../__mocks__/configResolver.js';
import path from 'path';
import {fileURLToPath} from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MAGENTO_SCENARIOS_PATH = path.resolve(__dirname,'../magento_scenarios');

let scenarios = [
    {
        scenario: 'a',
        themes: [
            {
                code: 'Vendor/theme-a',
                expected: {
                    'Vendor_ModuleNameA/components/ComponentA': 'app/design/frontend/Vendor/theme-a/Vendor_ModuleNameA/web/components/ComponentA.vue',
                    'Vendor_ModuleNameA/components/ComponentB': 'app/design/frontend/Vendor/theme-a/Vendor_ModuleNameA/web/components/ComponentB.vue',
                    'Vendor_ModuleNameA/js/main': 'app/design/frontend/Vendor/theme-a/Vendor_ModuleNameA/web/js/main.js',
                    'Vendor_ModuleNameB/components/ComponentA': 'app/design/frontend/Vendor/theme-a/Vendor_ModuleNameB/web/components/ComponentA.vue',
                    'Vendor_ModuleNameB/components/ComponentB': 'app/design/frontend/Vendor/theme-a/Vendor_ModuleNameB/web/components/ComponentB.vue',
                    'Vendor_ModuleNameB/js/main': 'app/design/frontend/Vendor/theme-a/Vendor_ModuleNameB/web/js/main.js',
                    'Vendor_ModuleNameC/components/ComponentA': 'app/code/Vendor/ModuleNameC/view/frontend/web/components/ComponentA.vue',
                    'Vendor_ModuleNameC/components/ComponentB': 'app/code/Vendor/ModuleNameC/view/frontend/web/components/ComponentB.vue',
                    'Vendor_ModuleNameC/js/main': 'app/code/Vendor/ModuleNameC/view/frontend/web/js/main.js',
                    'Theme/components/ComponentA': 'app/design/frontend/Vendor/theme-a/web/components/ComponentA.vue',
                    'Theme/components/ComponentB': 'app/design/frontend/Vendor/theme-a/web/components/ComponentB.vue',
                    'Theme/js/main': 'app/design/frontend/Vendor/theme-a/web/js/main.js'
                }
            },
            {
                code: 'Vendor/theme-b',
                expected: {
                    'Vendor_ModuleNameA/components/ComponentA': 'app/design/frontend/Vendor/theme-a/Vendor_ModuleNameA/web/components/ComponentA.vue',
                    'Vendor_ModuleNameA/components/ComponentB': 'app/design/frontend/Vendor/theme-a/Vendor_ModuleNameA/web/components/ComponentB.vue',
                    'Vendor_ModuleNameA/js/main': 'app/design/frontend/Vendor/theme-a/Vendor_ModuleNameA/web/js/main.js',
                    'Vendor_ModuleNameB/components/ComponentA': 'app/design/frontend/Vendor/theme-a/Vendor_ModuleNameB/web/components/ComponentA.vue',
                    'Vendor_ModuleNameB/components/ComponentB': 'app/design/frontend/Vendor/theme-a/Vendor_ModuleNameB/web/components/ComponentB.vue',
                    'Vendor_ModuleNameB/js/main': 'app/design/frontend/Vendor/theme-a/Vendor_ModuleNameB/web/js/main.js',
                    'Vendor_ModuleNameC/components/ComponentA': 'app/code/Vendor/ModuleNameC/view/frontend/web/components/ComponentA.vue',
                    'Vendor_ModuleNameC/components/ComponentB': 'app/code/Vendor/ModuleNameC/view/frontend/web/components/ComponentB.vue',
                    'Vendor_ModuleNameC/js/main': 'app/code/Vendor/ModuleNameC/view/frontend/web/js/main.js',
                    'Theme/components/ComponentA': 'app/design/frontend/Vendor/theme-a/web/components/ComponentA.vue',
                    'Theme/components/ComponentB': 'app/design/frontend/Vendor/theme-a/web/components/ComponentB.vue',
                    'Theme/js/main': 'app/design/frontend/Vendor/theme-a/web/js/main.js'
                }
            },
            {
                code: 'Vendor/theme-c',
                expected: {
                    'Vendor_ModuleNameA/components/ComponentA': 'app/design/frontend/Vendor/theme-a/Vendor_ModuleNameA/web/components/ComponentA.vue',
                    'Vendor_ModuleNameA/components/ComponentB': 'app/design/frontend/Vendor/theme-a/Vendor_ModuleNameA/web/components/ComponentB.vue',
                    'Vendor_ModuleNameA/js/main': 'app/design/frontend/Vendor/theme-a/Vendor_ModuleNameA/web/js/main.js',
                    'Vendor_ModuleNameB/components/ComponentA': 'app/design/frontend/Vendor/theme-c/Vendor_ModuleNameB/web/components/ComponentA.vue',
                    'Vendor_ModuleNameB/components/ComponentB': 'app/design/frontend/Vendor/theme-c/Vendor_ModuleNameB/web/components/ComponentB.vue',
                    'Vendor_ModuleNameB/js/main': 'app/design/frontend/Vendor/theme-c/Vendor_ModuleNameB/web/js/main.js',
                    'Vendor_ModuleNameC/components/ComponentA': 'app/code/Vendor/ModuleNameC/view/frontend/web/components/ComponentA.vue',
                    'Vendor_ModuleNameC/components/ComponentB': 'app/code/Vendor/ModuleNameC/view/frontend/web/components/ComponentB.vue',
                    'Vendor_ModuleNameC/js/main': 'app/code/Vendor/ModuleNameC/view/frontend/web/js/main.js',
                    'Theme/components/ComponentA': 'app/design/frontend/Vendor/theme-a/web/components/ComponentA.vue',
                    'Theme/components/ComponentB': 'app/design/frontend/Vendor/theme-a/web/components/ComponentB.vue',
                    'Theme/js/main': 'app/design/frontend/Vendor/theme-a/web/js/main.js'
                }
            },
            {
                code: 'Vendor/theme-d',
                expected: {
                    'Vendor_ModuleNameA/components/ComponentA': 'app/code/Vendor/ModuleNameA/view/frontend/web/components/ComponentA.vue',
                    'Vendor_ModuleNameA/components/ComponentB': 'app/code/Vendor/ModuleNameA/view/frontend/web/components/ComponentB.vue',
                    'Vendor_ModuleNameA/js/main': 'app/code/Vendor/ModuleNameA/view/frontend/web/js/main.js',
                    'Vendor_ModuleNameB/components/ComponentA': 'app/code/Vendor/ModuleNameB/view/frontend/web/components/ComponentA.vue',
                    'Vendor_ModuleNameB/components/ComponentB': 'app/code/Vendor/ModuleNameB/view/frontend/web/components/ComponentB.vue',
                    'Vendor_ModuleNameB/js/main': 'app/code/Vendor/ModuleNameB/view/frontend/web/js/main.js',
                    'Vendor_ModuleNameC/components/ComponentA': 'app/code/Vendor/ModuleNameC/view/frontend/web/components/ComponentA.vue',
                    'Vendor_ModuleNameC/components/ComponentB': 'app/code/Vendor/ModuleNameC/view/frontend/web/components/ComponentB.vue',
                    'Vendor_ModuleNameC/js/main': 'app/code/Vendor/ModuleNameC/view/frontend/web/js/main.js',
                }
            },
        ]
    },
    {
        scenario: 'b',
        themes: [
            {
                code: 'Vendor/theme-a',
                expected: {
                    'Vendor_ModuleNameA/components/ComponentA': 'app/design/frontend/Vendor/theme-a/Vendor_ModuleNameA/web/components/ComponentA.vue',
                    'Vendor_ModuleNameA/components/ComponentB': 'app/design/frontend/Vendor/theme-a/Vendor_ModuleNameA/web/components/ComponentB.vue',
                    'Vendor_ModuleNameA/js/main': 'app/design/frontend/Vendor/theme-a/Vendor_ModuleNameA/web/js/main.js',
                    'Vendor_ModuleNameB/components/ComponentA': 'app/design/frontend/Vendor/theme-a/Vendor_ModuleNameB/web/components/ComponentA.vue',
                    'Vendor_ModuleNameB/components/ComponentB': 'app/design/frontend/Vendor/theme-a/Vendor_ModuleNameB/web/components/ComponentB.vue',
                    'Vendor_ModuleNameB/js/main': 'app/design/frontend/Vendor/theme-a/Vendor_ModuleNameB/web/js/main.js',
                    'Vendor_ModuleNameC/components/ComponentA': 'app/code/Vendor/ModuleNameC/view/frontend/web/components/ComponentA.vue',
                    'Vendor_ModuleNameC/components/ComponentB': 'app/code/Vendor/ModuleNameC/view/frontend/web/components/ComponentB.vue',
                    'Vendor_ModuleNameC/js/main': 'app/code/Vendor/ModuleNameC/view/frontend/web/js/main.js',
                    'Theme/components/ComponentA': 'app/design/frontend/Vendor/theme-a/web/components/ComponentA.vue',
                    'Theme/components/ComponentB': 'app/design/frontend/Vendor/theme-a/web/components/ComponentB.vue',
                    'Theme/js/main': 'app/design/frontend/Vendor/theme-a/web/js/main.js',
                    'Vendor_ModuleNameNoConfig/components/ComponentA': 'app/design/frontend/Vendor/theme-a/Vendor_ModuleNameNoConfig/web/components/ComponentA.vue',
                    'Vendor_ModuleNameNoConfig/components/ComponentB': 'app/design/frontend/Vendor/theme-a/Vendor_ModuleNameNoConfig/web/components/ComponentB.vue',
                    'Vendor_ModuleNameNoConfig/js/main': 'app/design/frontend/Vendor/theme-a/Vendor_ModuleNameNoConfig/web/js/main.js',
                }
            },
            {
                code: 'Vendor/theme-b',
                expected: {
                    'Vendor_ModuleNameA/components/ComponentA': 'app/design/frontend/Vendor/theme-a/Vendor_ModuleNameA/web/components/ComponentA.vue',
                    'Vendor_ModuleNameA/components/ComponentB': 'app/design/frontend/Vendor/theme-a/Vendor_ModuleNameA/web/components/ComponentB.vue',
                    'Vendor_ModuleNameA/js/main': 'app/design/frontend/Vendor/theme-a/Vendor_ModuleNameA/web/js/main.js',
                    'Vendor_ModuleNameB/components/ComponentA': 'app/design/frontend/Vendor/theme-a/Vendor_ModuleNameB/web/components/ComponentA.vue',
                    'Vendor_ModuleNameB/components/ComponentB': 'app/design/frontend/Vendor/theme-a/Vendor_ModuleNameB/web/components/ComponentB.vue',
                    'Vendor_ModuleNameB/js/main': 'app/design/frontend/Vendor/theme-a/Vendor_ModuleNameB/web/js/main.js',
                    'Vendor_ModuleNameC/components/ComponentA': 'app/code/Vendor/ModuleNameC/view/frontend/web/components/ComponentA.vue',
                    'Vendor_ModuleNameC/components/ComponentB': 'app/code/Vendor/ModuleNameC/view/frontend/web/components/ComponentB.vue',
                    'Vendor_ModuleNameC/js/main': 'app/code/Vendor/ModuleNameC/view/frontend/web/js/main.js',
                    'Theme/components/ComponentA': 'app/design/frontend/Vendor/theme-a/web/components/ComponentA.vue',
                    'Theme/components/ComponentB': 'app/design/frontend/Vendor/theme-a/web/components/ComponentB.vue',
                    'Theme/js/main': 'app/design/frontend/Vendor/theme-a/web/js/main.js',
                    'Vendor_ModuleNameNoConfig/components/ComponentA': 'app/design/frontend/Vendor/theme-a/Vendor_ModuleNameNoConfig/web/components/ComponentA.vue',
                    'Vendor_ModuleNameNoConfig/components/ComponentB': 'app/design/frontend/Vendor/theme-a/Vendor_ModuleNameNoConfig/web/components/ComponentB.vue',
                    'Vendor_ModuleNameNoConfig/js/main': 'app/design/frontend/Vendor/theme-a/Vendor_ModuleNameNoConfig/web/js/main.js',
                }
            },
            {
                code: 'Vendor/theme-c',
                expected: {
                    'Vendor_ModuleNameA/components/ComponentA': 'app/design/frontend/Vendor/theme-a/Vendor_ModuleNameA/web/components/ComponentA.vue',
                    'Vendor_ModuleNameA/components/ComponentB': 'app/design/frontend/Vendor/theme-a/Vendor_ModuleNameA/web/components/ComponentB.vue',
                    'Vendor_ModuleNameA/js/main': 'app/design/frontend/Vendor/theme-a/Vendor_ModuleNameA/web/js/main.js',
                    'Vendor_ModuleNameB/components/ComponentA': 'app/design/frontend/Vendor/theme-c/Vendor_ModuleNameB/web/components/ComponentA.vue',
                    'Vendor_ModuleNameB/components/ComponentB': 'app/design/frontend/Vendor/theme-c/Vendor_ModuleNameB/web/components/ComponentB.vue',
                    'Vendor_ModuleNameB/js/main': 'app/design/frontend/Vendor/theme-c/Vendor_ModuleNameB/web/js/main.js',
                    'Vendor_ModuleNameC/components/ComponentA': 'app/code/Vendor/ModuleNameC/view/frontend/web/components/ComponentA.vue',
                    'Vendor_ModuleNameC/components/ComponentB': 'app/code/Vendor/ModuleNameC/view/frontend/web/components/ComponentB.vue',
                    'Vendor_ModuleNameC/js/main': 'app/code/Vendor/ModuleNameC/view/frontend/web/js/main.js',
                    'Theme/components/ComponentA': 'app/design/frontend/Vendor/theme-a/web/components/ComponentA.vue',
                    'Theme/components/ComponentB': 'app/design/frontend/Vendor/theme-a/web/components/ComponentB.vue',
                    'Theme/js/main': 'app/design/frontend/Vendor/theme-a/web/js/main.js',
                    'Vendor_ModuleNameNoConfig/components/ComponentA': 'app/design/frontend/Vendor/theme-a/Vendor_ModuleNameNoConfig/web/components/ComponentA.vue',
                    'Vendor_ModuleNameNoConfig/components/ComponentB': 'app/design/frontend/Vendor/theme-a/Vendor_ModuleNameNoConfig/web/components/ComponentB.vue',
                    'Vendor_ModuleNameNoConfig/js/main': 'app/design/frontend/Vendor/theme-a/Vendor_ModuleNameNoConfig/web/js/main.js',
                }
            },
            {
                code: 'Vendor/theme-d',
                expected: {
                    'Vendor_ModuleNameA/components/ComponentA': 'app/code/Vendor/ModuleNameA/view/frontend/web/components/ComponentA.vue',
                    'Vendor_ModuleNameA/components/ComponentB': 'app/code/Vendor/ModuleNameA/view/frontend/web/components/ComponentB.vue',
                    'Vendor_ModuleNameA/js/main': 'app/code/Vendor/ModuleNameA/view/frontend/web/js/main.js',
                    'Vendor_ModuleNameC/components/ComponentA': 'app/code/Vendor/ModuleNameC/view/frontend/web/components/ComponentA.vue',
                    'Vendor_ModuleNameC/components/ComponentB': 'app/code/Vendor/ModuleNameC/view/frontend/web/components/ComponentB.vue',
                    'Vendor_ModuleNameC/js/main': 'app/code/Vendor/ModuleNameC/view/frontend/web/js/main.js',
                }
            },
        ]
    },
];

for (const scenario of scenarios) {
    for (const key in scenario.themes) {
        let themes = scenario.themes[key];
        for (const key in themes.expected) {
            let expected = themes.expected[key];
            themes.expected[key] = path.resolve(MAGENTO_SCENARIOS_PATH, expected);
        }
    }
}

describe('getAllJsVueFilesWithInheritance', () => {
    let moduleResolver;

    beforeEach(async () => {
        jest.resetModules()
    });

    test.each(scenarios.flatMap(({ scenario, themes }) =>
        themes.map(({ code, expected }) => ([ scenario, code, expected ]))
    ))('Scenario "%s", Theme "%s"', async (scenario, code, expected) => {
        jest.unstable_mockModule(
            '#service/configResolver.cjs',
            () => createMockConfigResolver(scenario)
        );
        moduleResolver = await import('#service/moduleResolver.js');
        moduleResolver = moduleResolver.default;

        const result = await moduleResolver.getAllJsVueFilesWithInheritance(code);

        // Mensaje personalizado para errores
        expect(result).toEqual(expected, `Failed for scenario "${scenario}", theme "${code}"`);
    });


});
