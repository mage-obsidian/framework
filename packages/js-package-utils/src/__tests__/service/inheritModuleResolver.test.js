import { vi } from "vitest";
import createMockConfigResolver from "../__mocks__/configResolver.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let scenarios = [
    {
        scenario: "a",
        themes: [
            {
                code: "Vendor/theme-a",
                codeImport: "Vendor_ModuleNameA::js/test",
                expected: "/TEST/web/js/test.js",
            },
            {
                code: "Vendor/theme-a",
                codeImport: "Vendor_ModuleNameA::js/test.vue",
                expected: "/TEST/web/js/test.js",
            },
            {
                code: "Vendor/theme-a",
                codeImport: "Vendor_ModuleNameA::js/test.css",
                expected: undefined,
            },
            {
                code: "Vendor/theme-a",
                codeImport: "Vendor_ModuleNameB::js/test",
                expected: undefined,
            },
            { code: "Vendor/theme-a", codeImport: null, expected: undefined },
            {
                code: "Vendor/theme-b",
                codeImport: "Vendor_ModuleNameA::js/unknown",
                expected: undefined,
            },
        ],
    },
];

function mockConfigAndModules(scenario) {
    vi.doMock("#core/configResolver.ts", () => ({
        __esModule: true,
        default: createMockConfigResolver(scenario).default,
    }));

    vi.doMock("#core/moduleResolver.ts", () => ({
        __esModule: true,
        default: {
            getAllJsVueFilesWithInheritanceCached: vi.fn(() => ({
                "Vendor_ModuleNameA/js/test": "/TEST/web/js/test.js",
            })),
        },
    }));
}

async function setupInheritModuleResolver(scenario) {
    mockConfigAndModules(scenario);
    const { default: inheritModuleResolverFactory } =
        await import("#vite/inheritModuleResolver.ts");
    return inheritModuleResolverFactory();
}

describe("inherit-resolver", () => {
    let inheritModuleResolver;

    beforeEach(() => {
        vi.resetModules();
    });

    test.each(
        scenarios.flatMap(({ scenario, themes }) =>
            themes.map(({ code, codeImport, expected }) => [scenario, code, codeImport, expected]),
        ),
    )('Scenario "%s", Theme "%s", Import "%s"', async (scenario, code, codeImport, expected) => {
        process.env.CURRENT_THEME = code;
        inheritModuleResolver = await setupInheritModuleResolver(scenario);
        const result = await inheritModuleResolver.resolveId.handler(codeImport);

        expect(result).toEqual(expected);
    });
});
