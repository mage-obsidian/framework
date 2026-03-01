import { jest } from '@jest/globals';

/**
 * The precompile guard must key on (theme, contract hash), not just the theme
 * name: the same theme re-precompiles when the contract changes (e.g. a module
 * enabled/disabled while a long-lived dev server runs), while a repeated call
 * with an unchanged contract is skipped.
 */
describe('preCompileMagentoFiles guard', () => {
    beforeEach(() => {
        jest.resetModules();
    });

    test('skips on same theme+hash and recompiles when the hash changes', async () => {
        let currentHash = 'hash-1';
        const precompileJs = jest.fn(async () => {});
        const precompileCss = jest.fn(async () => {});

        jest.unstable_mockModule('#core/configResolver.js', () => ({
            __esModule: true,
            default: { getContractHash: () => currentHash }
        }));
        jest.unstable_mockModule('#core/preCompileFiles.js', () => ({
            __esModule: true,
            precompileJs,
            precompileCss
        }));
        jest.unstable_mockModule('node:fs/promises', () => ({
            __esModule: true,
            default: { rm: jest.fn(async () => {}), mkdir: jest.fn(async () => {}) }
        }));

        const { default: preCompileMagentoFiles } = await import('#core/preCompileMagentoFiles.js');

        await preCompileMagentoFiles('Vendor/theme-a');
        await preCompileMagentoFiles('Vendor/theme-a');
        expect(precompileJs).toHaveBeenCalledTimes(1); // second call guarded

        currentHash = 'hash-2'; // contract changed (module enabled/disabled)
        await preCompileMagentoFiles('Vendor/theme-a');
        expect(precompileJs).toHaveBeenCalledTimes(2); // recomputed on new hash

        await preCompileMagentoFiles('Vendor/theme-b');
        expect(precompileJs).toHaveBeenCalledTimes(3); // different theme

        expect(precompileCss).toHaveBeenCalledTimes(3);
    });
});
