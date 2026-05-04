import { vi } from "vitest";
import createMockConfigResolver from "../__mocks__/configResolver.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCENARIOS = path.resolve(__dirname, "../magento_scenarios");
const abs = (p) => path.resolve(SCENARIOS, p);

describe("getTemplateSources", () => {
    beforeEach(() => {
        vi.resetModules();
    });

    test("emits a @source for every theme in the inheritance chain", async () => {
        vi.doMock("#core/configResolver.ts", () => ({
            __esModule: true,
            default: createMockConfigResolver("a").default,
        }));
        const { getTemplateSources } = await import("#core/cssResolver.ts");

        // theme-c -> theme-b -> theme-a
        const out = await getTemplateSources("Vendor/theme-c");

        expect(out).toContain(`@source "${abs("app/design/frontend/Vendor/theme-c")}"`);
        expect(out).toContain(`@source "${abs("app/design/frontend/Vendor/theme-b")}"`);
        expect(out).toContain(`@source "${abs("app/design/frontend/Vendor/theme-a")}"`);
    });

    test("emits a @source for module template dirs that exist and skips those that don't", async () => {
        vi.doMock("#core/configResolver.ts", () => ({
            __esModule: true,
            default: createMockConfigResolver("a").default,
        }));
        const { getTemplateSources } = await import("#core/cssResolver.ts");

        const out = await getTemplateSources("Vendor/theme-a");

        // ModuleNameC has view/frontend/templates in the fixtures, A and B don't.
        expect(out).toContain(
            `@source "${abs("app/code/Vendor/ModuleNameC/view/frontend/templates")}"`,
        );
        expect(out).not.toContain(
            `@source "${abs("app/code/Vendor/ModuleNameA/view/frontend/templates")}"`,
        );
        expect(out).not.toContain(
            `@source "${abs("app/code/Vendor/ModuleNameB/view/frontend/templates")}"`,
        );
    });
});
