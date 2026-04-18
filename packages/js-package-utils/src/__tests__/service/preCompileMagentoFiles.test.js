import { vi } from "vitest";

/**
 * The precompile guard must key on (theme, contract hash), not just the theme
 * name: the same theme re-precompiles when the contract changes (e.g. a module
 * enabled/disabled while a long-lived dev server runs), while a repeated call
 * with an unchanged contract is skipped.
 */
describe("preCompileMagentoFiles guard", () => {
    beforeEach(() => {
        vi.resetModules();
    });

    test("skips on same theme+hash and recompiles when the hash changes", async () => {
        let currentHash = "hash-1";
        const precompileJs = vi.fn(async () => {});
        const precompileCss = vi.fn(async () => {});
        const precompileDts = vi.fn(async () => {});

        vi.doMock("#core/configResolver.ts", () => ({
            __esModule: true,
            default: { getContractHash: () => currentHash },
        }));
        vi.doMock("#core/preCompileFiles.ts", () => ({
            __esModule: true,
            precompileJs,
            precompileCss,
            precompileDts,
        }));
        vi.doMock("node:fs/promises", () => ({
            __esModule: true,
            default: { rm: vi.fn(async () => {}), mkdir: vi.fn(async () => {}) },
        }));

        const { default: preCompileMagentoFiles } = await import("#core/preCompileMagentoFiles.ts");

        await preCompileMagentoFiles("Vendor/theme-a");
        await preCompileMagentoFiles("Vendor/theme-a");
        expect(precompileJs).toHaveBeenCalledTimes(1); // second call guarded

        currentHash = "hash-2"; // contract changed (module enabled/disabled)
        await preCompileMagentoFiles("Vendor/theme-a");
        expect(precompileJs).toHaveBeenCalledTimes(2); // recomputed on new hash

        await preCompileMagentoFiles("Vendor/theme-b");
        expect(precompileJs).toHaveBeenCalledTimes(3); // different theme

        expect(precompileCss).toHaveBeenCalledTimes(3);
        expect(precompileDts).toHaveBeenCalledTimes(3);
    });
});
